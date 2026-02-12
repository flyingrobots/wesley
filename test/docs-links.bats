#!/usr/bin/env bats

# Verify that relative markdown links in docs/ and root resolve to real files.
# Guards against broken paths after moves/archives/deletes.

check_links() {
  broken=0
  while IFS=: read -r file match; do
    # Extract the path portion from [text](path) or [text](path "title")
    path="${match#*](}"
    path="${path%)}"
    # Strip optional title attribute: (path "title") or (path 'title')
    path="${path%% \"*}"
    path="${path%% \'*}"
    # Skip external URLs, anchors, and empty links
    [[ "$path" == http* ]] && continue
    [[ "$path" == "#"* ]] && continue
    [[ -z "$path" ]] && continue
    # Strip any anchor fragment
    path="${path%%#*}"
    # Resolve relative to the file's directory
    dir="$(dirname "$file")"
    resolved="$dir/$path"
    if [ ! -f "$resolved" ] && [ ! -d "$resolved" ]; then
      echo "BROKEN: $file -> $path (resolved: $resolved)"
      broken=$((broken + 1))
    fi
  done < <(grep -rn --include='*.md' -oE '\[[^]]*\]\([^)]+\)' docs/ *.md 2>/dev/null || true)
  [ "$broken" -eq 0 ]
}

@test "relative markdown links in docs/ and root .md files resolve to existing files" {
  run check_links
  [ "$status" -eq 0 ]
}
