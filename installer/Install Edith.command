#!/bin/bash
# Installs or updates Edith. Safe to run for every update: it replaces the old copy of Edith.app and keeps
# your settings, version history and open tabs. It touches nothing except Edith.app itself.
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/Edith.app"
echo; echo "Edith installer"; echo "---------------"
if [ ! -d "$SRC" ]; then echo "Can't find 'Edith.app' next to this installer. Keep the two together and try again."; read -n 1 -s -r -p "Press any key to close."; echo; exit 1; fi

# Quit a running copy of Edith so it can be replaced
osascript -e 'if application id "app.edith.mac" is running then tell application id "app.edith.mac" to quit' >/dev/null 2>&1
sleep 1

# Only ever replace an app that really is Edith (bundle id app.edith.mac); a different app that happens
# to be called Edith.app is left alone and the install stops.
is_edith_or_absent() { [ ! -e "$1" ] || [ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$1/Contents/Info.plist" 2>/dev/null)" = "app.edith.mac" ]; }
refuse() { echo "Another app named Edith.app is already at $1. It was not touched; move or rename it, then run this installer again."; read -n 1 -s -r -p "Press any key to close."; echo; exit 1; }

# Install into /Applications, or ~/Applications if that isn't allowed
DEST="/Applications/Edith.app"
is_edith_or_absent "$DEST" || refuse "$DEST"
rm -rf "$DEST" 2>/dev/null
if ! ditto "$SRC" "$DEST" 2>/dev/null; then
  mkdir -p "$HOME/Applications"; DEST="$HOME/Applications/Edith.app"
  is_edith_or_absent "$DEST" || refuse "$DEST"
  rm -rf "$DEST"; ditto "$SRC" "$DEST"
fi

# Clear the download quarantine flag and give the app a local signature so macOS will run it
xattr -cr "$DEST" 2>/dev/null
codesign --force --deep --sign - "$DEST" >/dev/null 2>&1
touch "$DEST"

echo "Installed to: $DEST"; echo
echo "Opening Edith now. To keep it in your Dock: right-click its Dock icon > Options > Keep in Dock."
echo "You can delete the downloaded zip and this folder; Edith lives in Applications."
open "$DEST"; sleep 1
