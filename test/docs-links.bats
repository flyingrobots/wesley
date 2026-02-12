#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

# Verify that relative markdown links in docs/ and root resolve to real files.
# Guards against broken paths after moves/archives/deletes.

@test "relative markdown links in docs/ resolve to existing files" {
  broken=0
  while IFS=: read -r file match; do
    # Extract the path portion from [text](path)
    path="${match#*](}"
    path="${path%)}"
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
      echo "BROKEN: $file -> $path (resolved: $resolved)" >&2
      broken=$((broken + 1))
    fi
  done < <(grep -rn --include='*.md' -oE '\[[^]]*\]\([^)]+\)' docs/ ROADMAP.md)
  [ "$broken" -eq 0 ]
}
