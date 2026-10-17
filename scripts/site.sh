#!/bin/bash
# Assembles the website into _site/ for GitHub Pages (.github/workflows/pages.yml): everything in docs/, plus the
# app page as a try-it demo at demo/, marked <html data-demo> so it shows the "running in your browser" bar.
# Run `npm run build` first. Works on Linux and macOS.
set -euo pipefail
[ -f dist.html ] || { echo "No dist.html; run npm run build first" >&2; exit 1; }
rm -rf _site && mkdir -p _site/demo
cp -R docs/. _site/
grep -q '^<html lang="en">$' dist.html || { echo "dist.html has no <html lang=\"en\"> line to mark" >&2; exit 1; }
sed 's/^<html lang="en">$/<html lang="en" data-demo>/' dist.html > _site/demo/index.html
echo "_site: $(du -sh _site | cut -f1), demo $(du -h _site/demo/index.html | cut -f1)"
