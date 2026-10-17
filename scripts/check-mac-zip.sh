#!/bin/bash
# Checks that a release zip opens the ways people open it, and that what comes out is a runnable Edith.app.
#   scripts/check-mac-zip.sh "out/Edith (Apple Silicon).zip"            fail on any problem
#   scripts/check-mac-zip.sh some.zip --report-only                    print results, never fail (diagnostics)
# Checks: unzip -t (CRCs), ditto -x -k, bsdtar (libarchive), and Archive Utility itself (what a double-click runs),
# also on a copy marked as downloaded (com.apple.quarantine).
# After each extraction: Edith.app is there, its binary and the installer are executable, codesign -dv reads it,
# and the brand sheet (Edith Brand.md) is not in it.
# macOS only.
set -uo pipefail
ZIP="$1"; MODE="${2:-}"
NAME="Edith (Apple Silicon)"
bad=0
fail() { if [ "$MODE" = "--report-only" ]; then echo "REPORT: $1"; else echo "::error::$1"; fi; bad=1; }
pass() { echo "ok: $1"; }
[ -f "$ZIP" ] || { echo "::error::No zip at $ZIP"; exit 1; }
ZIP=$(cd "$(dirname "$ZIP")" && pwd)/$(basename "$ZIP")
echo "Checking $ZIP ($(stat -f %z "$ZIP") bytes) on macOS $(sw_vers -productVersion)"
zipinfo -h "$ZIP" | sed 's/^/  /'
zipinfo -1 "$ZIP" | head -5 | sed 's/^/  entry: /'

# The extracted folder must hold Edith.app (runnable) and the installer files.
check_tree() { # $1 = how it was extracted, $2 = folder that should contain Edith.app
  local how="$1" dir="$2" app="$2/Edith.app"
  if [ ! -d "$app" ]; then fail "$how: no Edith.app in $(ls "$(dirname "$dir")" 2>/dev/null | tr '\n' '|')"; return; fi
  [ -x "$app/Contents/MacOS/Edith" ] && pass "$how: app binary is executable" || fail "$how: app binary is not executable"
  [ -x "$dir/Install Edith.command" ] && pass "$how: installer is executable" || fail "$how: Install Edith.command is missing or not executable"
  [ -f "$dir/READ ME FIRST.md" ] && pass "$how: READ ME FIRST.md is there" || fail "$how: READ ME FIRST.md is missing"
  # the brand sheet is for contributors and stays in the repository (since 3.7.4)
  [ ! -e "$dir/Edith Brand.md" ] && pass "$how: no brand sheet in the download" || fail "$how: Edith Brand.md should not be in the zip"
  if codesign -dv "$app" 2>"$dir/../codesign.txt"; then pass "$how: codesign -dv: $(grep -E '^(Signature|Identifier)=' "$dir/../codesign.txt" | tr '\n' ' ')"; else fail "$how: codesign -dv failed: $(tr '\n' ' ' < "$dir/../codesign.txt")"; fi
  # informational: the installer re-signs the copy it installs, so a stale bundle seal here is not fatal
  codesign --verify --deep --strict "$app" >/dev/null 2>&1 && echo "  (codesign --verify --deep --strict: valid)" || echo "  (codesign --verify --deep --strict: not valid; Install Edith.command re-signs the installed copy)"
}

T=$(mktemp -d)
# a zip made by Compress holds one top folder; an older zip (files at the top) expands without it
root_of() { if [ -d "$1/$NAME" ]; then echo "$1/$NAME"; else echo "$1"; fi; }

if unzip -tq "$ZIP" >"$T/unzip.txt" 2>&1; then pass "unzip -t: $(tail -1 "$T/unzip.txt")"; else fail "unzip -t: $(tail -3 "$T/unzip.txt" | tr '\n' ' ')"; fi

mkdir "$T/ditto"
if ditto -x -k "$ZIP" "$T/ditto" 2>"$T/ditto.txt"; then check_tree "ditto -x -k" "$(root_of "$T/ditto")"; else fail "ditto -x -k: $(cat "$T/ditto.txt")"; fi

mkdir "$T/bsdtar"
if /usr/bin/bsdtar -xf "$ZIP" -C "$T/bsdtar" 2>"$T/bsdtar.txt"; then check_tree "bsdtar -xf" "$(root_of "$T/bsdtar")"; else fail "bsdtar -xf: $(cat "$T/bsdtar.txt")"; fi

# Archive Utility, as on a double-click. It expands next to the archive and shows a dialog on failure, so wait for
# the folder to appear rather than for the app to quit. Run twice: as built, and quarantined like a browser download.
AU="/System/Library/CoreServices/Applications/Archive Utility.app"
au_check() { # $1 = label, $2 = folder, $3 = "quarantine" to mark the copy as downloaded
  local how="$1" d="$2"
  mkdir "$d" && cp "$ZIP" "$d/"
  local z="$d/$(basename "$ZIP")"
  [ "${3:-}" = quarantine ] && xattr -w com.apple.quarantine "0083;$(printf '%x' "$(date +%s)");Safari;$(uuidgen)" "$z"
  open -g -a "$AU" "$z" 2>"$d.txt" || { fail "$how did not start: $(cat "$d.txt")"; return; }
  for _ in $(seq 1 90); do [ -x "$d/$NAME/Edith.app/Contents/MacOS/Edith" ] && break; sleep 2; done
  for _ in $(seq 1 15); do pgrep -q "Archive Utility" || break; sleep 2; done   # let it finish and quit
  pkill "Archive Utility" 2>/dev/null
  if [ -d "$d/$NAME" ]; then check_tree "$how" "$d/$NAME"; else fail "$how did not expand the zip within 3 minutes (folder: $(ls "$d" | tr '\n' '|'))"; fi
}
au_check "Archive Utility" "$T/au"
au_check "Archive Utility, quarantined download" "$T/auq" quarantine

rm -rf "$T"
if [ "$bad" = 0 ]; then echo "All zip checks passed."; elif [ "$MODE" = "--report-only" ]; then echo "Some checks failed (report only)."; else exit 1; fi
exit 0
