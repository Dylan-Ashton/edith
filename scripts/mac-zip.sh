#!/bin/bash
# Checks the app built by `npm run package` and zips it the way a release ships it:
# a folder "Edith (Apple Silicon)" with Edith.app, Install Edith.command and READ ME FIRST.md
# -> out/Edith (Apple Silicon).zip. scripts/check-mac-zip.sh then checks that the zip opens.
# Used by both .github/workflows/release.yml and the PR build in .github/workflows/test.yml. macOS only.
set -euo pipefail
APP="build/Edith-darwin-arm64/Edith.app"
fail() { echo "::error::$1"; exit 1; }

[ -d "$APP" ] || fail "No Edith.app was produced at $APP"
BIN="$APP/Contents/MacOS/Edith"
[ -f "$BIN" ] || fail "The app has no executable at $BIN"

want=$(node -p "require('./package.json').scripts.package.match(/--electron-version=(\\S+)/)[1]")
have=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Contents/Frameworks/Electron Framework.framework/Resources/Info.plist")
echo "Electron version: $have (package script asks for $want)"
[ "$have" = "$want" ] || fail "Electron $have was packaged, expected $want"

archs=$(lipo -archs "$BIN")
echo "lipo -archs $BIN: $archs"
[ "$archs" = "arm64" ] || fail "The app binary must be arm64 only, got: $archs"

plist="$APP/Contents/Info.plist"
echo "Version: $(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$plist")  Bundle id: $(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$plist")  Minimum macOS: $(/usr/libexec/PlistBuddy -c 'Print :LSMinimumSystemVersion' "$plist")"

# Zipped the way Finder's Compress does (ditto -c -k --sequesterRsrc --keepParent): one top folder, symlinks and
# permissions kept. (The Info-ZIP `zip -qry` archive used before opened in Archive Utility on macOS 26.6 in CI but was
# reported unopenable on a Mac, so the release uses Apple's own tool; check-mac-zip.sh tests both ways of opening.)
NAME="Edith (Apple Silicon)"
rm -rf out && mkdir -p "out/$NAME"
ditto "$APP" "out/$NAME/Edith.app"
cp "installer/Install Edith.command" "installer/READ ME FIRST.md" "out/$NAME/"
chmod +x "out/$NAME/Install Edith.command"
ditto -c -k --sequesterRsrc --keepParent "out/$NAME" "out/$NAME.zip"
ls -l "out/$NAME.zip"
