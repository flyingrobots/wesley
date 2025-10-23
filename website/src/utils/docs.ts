import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS_DIR = fileURLToPath(new URL('../../../docs/site', import.meta.url));

function ensureMarkdownPath(slug: string) {
  const safeSlug = slug.replace(/[^a-zA-Z0-9-_]/g, '');
  return path.join(DOCS_DIR, `${safeSlug}.md`);
}

export function listDocSlugs(): string[] {
  return fs
    .readdirSync(DOCS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name.slice(0, -3))
    .sort((a, b) => a.localeCompare(b));
}

export function getNavItems() {
  return listDocSlugs()
    .filter((slug) => slug !== 'index')
    .map((slug) => {
      const title = extractTitle(getDocContent(slug)) ?? humanizeSlug(slug);
      return { slug, label: title };
    });
}

export function getDocContent(slug: string) {
  const filePath = ensureMarkdownPath(slug);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Markdown file not found for slug: ${slug}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

function extractTitle(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^#\s+(.*)/);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

function humanizeSlug(slug: string) {
  return slug
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
