#!/bin/bash
# Assembles the website into _site/ for GitHub Pages (.github/workflows/pages.yml): everything in docs/, plus the
# "Try it" editor (site/try.js, bundled with Toast UI into assets/try.js and assets/try.css). Run `npm ci` first.
# Works on Linux and macOS.
set -euo pipefail
rm -rf _site && mkdir -p _site
cp -R docs/. _site/
npx --no-install esbuild site/try.js --bundle --minify --format=iife --log-level=warning --outfile=_site/assets/try.js
[ -s _site/assets/try.js ] && [ -s _site/assets/try.css ] || { echo "The try-it bundle was not built" >&2; exit 1; }
echo "_site: $(du -sh _site | cut -f1); try.js $(du -h _site/assets/try.js | cut -f1), try.css $(du -h _site/assets/try.css | cut -f1)"
