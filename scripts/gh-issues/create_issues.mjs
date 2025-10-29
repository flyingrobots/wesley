#!/usr/bin/env node
/**
 * Create GitHub issues for the Merge Projection plan and add them to the "Wesley" Project (Projects v2)
 * using GraphQL via the gh CLI.
 *
 * Requirements:
 *  - gh CLI installed and authenticated (gh auth status)
 *  - Permissions to create issues and edit the target Project v2
 *
 * Env vars:
 *  GH_OWNER            GitHub org/user (required)
 *  GH_REPO             Repository name (required)
 *  GH_PROJECT_TITLE    Project v2 title (e.g., "Wesley") OR GH_PROJECT_ID (node id)
 *  GH_PROJECT_ORG      '1' if the Project is org-level, otherwise repo-level (default: '1')
 *  GH_LINK_METHOD      'graphql' | 'rest' (default: 'graphql'); fallback to 'rest' if GraphQL link fails
 *  GH_LABELS           Comma-separated labels to add to all created issues (default: merge-projection,holmes,moriarty)
 *
 * Usage:
 *  GH_OWNER=flyingrobots GH_REPO=wesley GH_PROJECT_TITLE=Wesley node scripts/gh-issues/create_issues.mjs
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

function sh(cmd, inputObj) {
  const input = inputObj ? JSON.stringify(inputObj) : undefined;
  const out = execSync(cmd, { encoding: 'utf8', input });
  return out.trim();
}

function ghGraphQL(query, variables) {
  const data = sh('gh api graphql -f query=@- -f variables=@-', { query, variables: JSON.stringify(variables || {}) });
  return JSON.parse(data);
}

function tryDeleteProjectField(projectId, fieldId) {
  // Attempt common deletion shapes; ignore failures (idempotent behavior)
  try {
    const m1 = `mutation($projectId:ID!,$fieldId:ID!){ deleteProjectV2Field(input:{ projectId:$projectId, fieldId:$fieldId }){ projectV2{ id } } }`;
    ghGraphQL(m1, { projectId, fieldId });
    return true;
  } catch {}
  try {
    const m2 = `mutation($fieldId:ID!){ deleteProjectV2Field(input:{ fieldId:$fieldId }){ projectV2{ id } } }`;
    ghGraphQL(m2, { fieldId });
    return true;
  } catch {}
  return false;
}

function getRepoId(owner, repo) {
  const q = `query($owner:String!,$repo:String!){ repository(owner:$owner,name:$repo){ id } }`;
  const r = ghGraphQL(q, { owner, repo });
  const id = r?.data?.repository?.id;
  if (!id) throw new Error('Unable to resolve repository id');
  return id;
}

function getProjectId({ owner, repo, projectTitle, projectId, isOrg }) {
  if (projectId) return projectId;
  if (isOrg) {
    const q = `query($owner:String!,$title:String!){ organization(login:$owner){ projectsV2(first:50, query:$title){ nodes{ id title number } } } }`;
    const r = ghGraphQL(q, { owner, title: projectTitle });
    const nodes = r?.data?.organization?.projectsV2?.nodes || [];
    const node = nodes.find(n => n.title === projectTitle) || nodes[0];
    if (!node) throw new Error(`Org project not found: ${projectTitle}`);
    return node.id;
  }
  const q = `query($owner:String!,$repo:String!,$title:String!){ repository(owner:$owner,name:$repo){ projectsV2(first:50, query:$title){ nodes{ id title number } } } }`;
  const r = ghGraphQL(q, { owner, repo, title: projectTitle });
  const nodes = r?.data?.repository?.projectsV2?.nodes || [];
  const node = nodes.find(n => n.title === projectTitle) || nodes[0];
  if (!node) throw new Error(`Repo project not found: ${projectTitle}`);
  return node.id;
}

function getOrCreateFields(projectId) {
  const q = `query($id:ID!){ node(id:$id){ ... on ProjectV2 { fields(first:100){ nodes{ id name dataType ... on ProjectV2SingleSelectField { options{ id name } } } } } } }`;
  const r = ghGraphQL(q, { id: projectId });
  const fields = (r?.data?.node?.fields?.nodes || []).map(f => ({ id: f.id, name: f.name, dataType: f.dataType, options: f.options }));

  // Remove any non-standard Priority field, then ensure single-select Priority exists (P0..P4)
  const nonStandardPriority = fields.filter(f => f.name === 'Priority' && f.dataType !== 'SINGLE_SELECT');
  for (const f of nonStandardPriority) {
    tryDeleteProjectField(projectId, f.id);
  }
  // Re-fetch after deletion attempts
  const rAfter = ghGraphQL(q, { id: projectId });
  const fieldsAfter = (rAfter?.data?.node?.fields?.nodes || []).map(f => ({ id: f.id, name: f.name, dataType: f.dataType, options: f.options }));
  let priorityLabel = fieldsAfter.find(f => f.name === 'Priority' && f.dataType === 'SINGLE_SELECT');
  if (!priorityLabel) {
    const m = `mutation($projectId:ID!){ createProjectV2Field(input:{ projectId:$projectId, dataType:SINGLE_SELECT, name:\"Priority\", options:[{name:\"P0\"},{name:\"P1\"},{name:\"P2\"},{name:\"P3\"},{name:\"P4\"}]}){ projectV2Field{ id name } } }`;
    ghGraphQL(m, { projectId });
  }
  // Re-fetch to get option ids
  const r2 = ghGraphQL(q, { id: projectId });
  const fields2 = (r2?.data?.node?.fields?.nodes || []);
  priorityLabel = fields2.find(f => f.name === 'Priority' && f.dataType === 'SINGLE_SELECT');

  // Best-effort: enrich Priority options with descriptive names
  try {
    const desired = [
      { code: 'P0', name: 'P0 – Critical (prod/customer impact; start immediately)' },
      { code: 'P1', name: 'P1 – Urgent (high value; this/next sprint)' },
      { code: 'P2', name: 'P2 – Standard (normal planning)' },
      { code: 'P3', name: 'P3 – Low (nice-to-have)' },
      { code: 'P4', name: 'P4 – Icebox (idea/backlog)' }
    ];
    const current = (priorityLabel?.options || []).map(o => ({ id: o.id, name: o.name }));
    const needsUpdate = desired.some(d => {
      const match = current.find(o => o.name?.startsWith(d.code));
      return !match || match.name !== d.name;
    });
    if (needsUpdate) {
      const composed = desired.map(d => {
        const existing = current.find(o => o.name?.startsWith(d.code));
        return existing ? { id: existing.id, name: d.name } : { name: d.name };
      });
      const mUp = `mutation($projectId:ID!,$fieldId:ID!,$options:[ProjectV2SingleSelectFieldOptionInput!]!){ updateProjectV2Field(input:{ projectId:$projectId, fieldId:$fieldId, name:\"Priority\", dataType:SINGLE_SELECT, singleSelectOptions:$options }){ projectV2Field{ id name } } }`;
      ghGraphQL(mUp, { projectId, fieldId: priorityLabel.id, options: composed });
      const r3 = ghGraphQL(q, { id: projectId });
      const fields3 = (r3?.data?.node?.fields?.nodes || []);
      priorityLabel = fields3.find(f => f.name === 'Priority' && f.dataType === 'SINGLE_SELECT');
    }
  } catch {}

  let estimate = fields.find(f => f.name === 'Estimate (human hours)' && f.dataType === 'NUMBER');
  if (!estimate) {
    const m = `mutation($projectId:ID!){ createProjectV2Field(input:{ projectId:$projectId, dataType:NUMBER, name:\"Estimate (human hours)\"}){ projectV2Field{ id name } } }`;
    const res = ghGraphQL(m, { projectId });
    estimate = { id: res?.data?.createProjectV2Field?.projectV2Field?.id, name: 'Estimate (human hours)', dataType: 'NUMBER' };
  }

  const getPriorityOptionId = (label) => {
    const opts = priorityLabel?.options || [];
    const o = opts.find(o => o.name?.startsWith(label));
    return o?.id;
  };
  return { priorityFieldId: priorityLabel?.id, getPriorityOptionId, estimateFieldId: estimate?.id };
}

function createIssue(repoId, title, body) {
  const m = `mutation($repoId:ID!,$title:String!,$body:String!){ createIssue(input:{repositoryId:$repoId,title:$title,body:$body}){ issue{ id number url } } }`;
  const r = ghGraphQL(m, { repoId, title, body });
  return r?.data?.createIssue?.issue;
}

function addToProject(projectId, contentId) {
  const m = `mutation($projectId:ID!,$contentId:ID!){ addProjectV2ItemById(input:{ projectId:$projectId, contentId:$contentId }){ item{ id } } }`;
  const r = ghGraphQL(m, { projectId, contentId });
  return r?.data?.addProjectV2ItemById?.item?.id;
}

function setProjectNumber(projectId, itemId, fieldId, numberValue) {
  const m = `mutation($projectId:ID!,$itemId:ID!,$fieldId:ID!,$value:Float!){ updateProjectV2ItemFieldValue(input:{ projectId:$projectId, itemId:$itemId, fieldId:$fieldId, value:{ number:$value }}){ projectV2Item{ id } } }`;
  ghGraphQL(m, { projectId, itemId, fieldId, value: Number(numberValue) });
}

function setProjectSingleSelect(projectId, itemId, fieldId, optionId) {
  const m = `mutation($projectId:ID!,$itemId:ID!,$fieldId:ID!,$optionId:String!){ updateProjectV2ItemFieldValue(input:{ projectId:$projectId, itemId:$itemId, fieldId:$fieldId, value:{ singleSelectOptionId:$optionId }}){ projectV2Item{ id } } }`;
  ghGraphQL(m, { projectId, itemId, fieldId, optionId });
}

function ensureLabels(owner, repo, labels) {
  if (!labels?.length) return;
  const list = JSON.parse(sh(`gh api repos/${owner}/${repo}/labels?per_page=100`));
  const existing = new Set((list || []).map(l => l.name));
  for (const name of labels) {
    if (!existing.has(name)) {
      try { sh(`gh api -X POST repos/${owner}/${repo}/labels -f name='${name}' -f color=0366d6`); } catch {}
    }
  }
}

function addLabels(owner, repo, issueNumber, labels) {
  if (!labels?.length) return;
  const payload = { labels };
  sh(`gh api -X POST repos/${owner}/${repo}/issues/${issueNumber}/labels -f labels=@-`, payload);
}

function ensurePriorityLabels(owner, repo) {
  const palette = {
    P0: { color: 'd73a4a', description: 'Priority P0 (highest)' }, // red
    P1: { color: 'f66a0a', description: 'Priority P1' },           // orange
    P2: { color: 'fbca04', description: 'Priority P2' },           // yellow
    P3: { color: '0e8a16', description: 'Priority P3' },           // green
    P4: { color: '6e7781', description: 'Priority P4 (lowest)' }   // gray
  };
  const list = JSON.parse(sh(`gh api repos/${owner}/${repo}/labels?per_page=100`));
  const byName = new Map((list || []).map(l => [l.name, l]));
  for (const [name, meta] of Object.entries(palette)) {
    const existing = byName.get(name);
    if (!existing) {
      try { sh(`gh api -X POST repos/${owner}/${repo}/labels -f name='${name}' -f color='${meta.color}' -f description='${meta.description}'`); } catch {}
    } else if (existing.color.toLowerCase() !== meta.color.toLowerCase()) {
      // Update color for consistency (best effort)
      try { sh(`gh api -X PATCH repos/${owner}/${repo}/labels/${encodeURIComponent(name)} -f color='${meta.color}'`); } catch {}
    }
  }
}

function linkIssuesGraphQL(sourceId, targetId, type) {
  // Attempt GraphQL linked-issues (BLOCKS/BLOCKED_BY/RELATES_TO), may not be enabled for all accounts.
  const m = `mutation($sourceId:ID!,$targetId:ID!,$type:IssueLinkType!){ createIssueLink(input:{ sourceId:$sourceId, targetId:$targetId, type:$type }){ issueLink{ id, type } } }`;
  try {
    ghGraphQL(m, { sourceId, targetId, type });
    return true;
  } catch (e) {
    return false;
  }
}

function linkIssuesREST(owner, repo, sourceNumber, targetNumber, relationship) {
  // REST fallback: https://docs.github.com/rest/issues/issues#link-an-issue
  const cmd = `gh api -X POST repos/${owner}/${repo}/issues/${sourceNumber}/links -f target_issue_number=${targetNumber} -f relationship=${relationship}`;
  sh(cmd);
}

function main() {
  const owner = process.env.GH_OWNER;
  const repo = process.env.GH_REPO;
  const projectTitle = process.env.GH_PROJECT_TITLE || 'Wesley';
  const projectIdEnv = process.env.GH_PROJECT_ID;
  const isOrg = (process.env.GH_PROJECT_ORG || '1') === '1';
  const linkMethod = (process.env.GH_LINK_METHOD || 'graphql').toLowerCase();

  if (!owner || !repo) throw new Error('Set GH_OWNER and GH_REPO');
  const planPath = path.join(process.cwd(), 'scripts', 'gh-issues', 'issue_plan.json');
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));

  const repoId = getRepoId(owner, repo);
  const projectId = getProjectId({ owner, repo, projectTitle, projectId: projectIdEnv, isOrg });
  const { priorityFieldId, getPriorityOptionId, estimateFieldId } = getOrCreateFields(projectId);

  const defaultLabels = (process.env.GH_LABELS || 'merge-projection,holmes,moriarty').split(',').map(s => s.trim()).filter(Boolean);
  ensureLabels(owner, repo, defaultLabels);
  ensurePriorityLabels(owner, repo);

  const created = {}; // key -> { issueId, number, url, projectItemId }
  for (const item of plan) {
    const prLabel = item.priorityLabel || (typeof item.priority === 'number' ? ({5:'P0',4:'P1',3:'P2',2:'P3',1:'P4'}[item.priority] || 'P4') : 'P3');
    const body = `${item.body}\n\nPriority: ${prLabel}\nEstimate (hours): ${item.estimateHours}\nKey: ${item.key}`;
    const issue = createIssue(repoId, item.title, body);
    const projectItemId = addToProject(projectId, issue.id);
    // Set fields
    if (priorityFieldId) {
      const optId = getPriorityOptionId(prLabel);
      if (optId) setProjectSingleSelect(projectId, projectItemId, priorityFieldId, optId);
    }
    if (estimateFieldId) setProjectNumber(projectId, projectItemId, estimateFieldId, item.estimateHours);
    addLabels(owner, repo, issue.number, [...defaultLabels, prLabel]);
    created[item.key] = { ...issue, projectItemId };
    // eslint-disable-next-line no-console
    console.log(`Created ${item.key} → #${issue.number} ${issue.url}`);
  }

  // Link dependencies (blockedBy)
  for (const item of plan) {
    if (!item.blockedBy?.length) continue;
    const source = created[item.key];
    for (const depKey of item.blockedBy) {
      const target = created[depKey];
      if (!source || !target) continue;
      let linked = false;
      if (linkMethod === 'graphql') linked = linkIssuesGraphQL(source.id, target.id, 'BLOCKED_BY');
      if (!linked) linkIssuesREST(owner, repo, source.number, target.number, 'blocked_by');
      // eslint-disable-next-line no-console
      console.log(`Linked ${item.key} blocked_by ${depKey}`);
    }
  }
}

main();
