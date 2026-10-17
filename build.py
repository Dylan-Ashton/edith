import base64, hashlib, json, os, re

tpl = open("app.template.html").read()


def fonts_css(listfile):
    # Each woff2 becomes a data: URL so the app needs no network and no files beside the page.
    # Only the Latin and Latin Extended @font-face blocks are kept; woff fallbacks are dropped.
    lic = open("fonts/LICENSES.md", encoding="utf-8").read()
    assert "*/" not in lic
    out = ["/*\n" + lic + "*/"]
    for line in open(listfile, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        pkg, *sheets = line.split()
        base = os.path.join("node_modules", "@fontsource", pkg)
        for sheet in sheets:
            css = open(os.path.join(base, sheet), encoding="utf-8").read()
            for name, block in re.findall(r"/\* (\S+) \*/\s*(@font-face\s*\{.*?\})", css, re.S):
                if not re.search(r"-latin(-ext)?-\d+-(normal|italic)$", name):
                    continue

                def data_url(m):
                    data = open(os.path.join(base, m.group(1)), "rb").read()
                    return "url(data:font/woff2;base64," + base64.b64encode(data).decode("ascii") + ") format('woff2')"

                block = re.sub(r"url\(\./(files/[^)]+\.woff2)\) format\('woff2'\)(, url\([^)]+\.woff\) format\('woff'\))?", data_url, block)
                assert "url(./" not in block, name
                out.append(block)
    return "\n".join(out)


def repl(m):
    kind, path = m.group(1), m.group(2)
    if kind == "INLINE_FONTS":
        return fonts_css(path)
    data = open(path, encoding="utf-8").read()
    if kind == "INLINE_WORKER":
        # pdf.js ships its worker as an ES module, but a module worker cannot start from a blob: URL in a file:// page.
        # Turn it into a classic script: drop the final export and the two import.meta.url uses (wasm image decoders).
        tail = "export{WorkerMessageHandler};"
        assert data.rstrip().endswith(tail), path
        data = data.rstrip()[: -len(tail)].replace("import.meta.url", "self.location.href")
        assert "import.meta" not in data and not re.search(r"(^|[;}])\s*(import|export)[\s{*]", data), path
        kind = "INLINE_RAW"
    if kind in ("INLINE_JS", "INLINE_RAW"):
        data = re.sub(r"//# sourceMappingURL=\S+", "", data)
        assert "</script" not in data.lower(), path
    if kind == "INLINE_JSON":
        return json.dumps(data)
    if kind == "INLINE_CSS":
        assert "</style" not in data.lower(), path
    return data


out = re.sub(r"/\*__(INLINE_[A-Z]+):(.+?)__\*/", repl, tpl)

# Content-Security-Policy: every script is inline, so each one is allowed by its hash (no 'unsafe-inline').
scripts = re.findall(r'<script(?: type="module")?>(.*?)</script>', out, re.S)
hashes = " ".join("'sha256-" + base64.b64encode(hashlib.sha256(s.encode("utf-8")).digest()).decode() + "'" for s in scripts)
assert out.count("__CSP_SCRIPT_HASHES__") == 1
out = out.replace("__CSP_SCRIPT_HASHES__", hashes)

open("dist.html", "w", encoding="utf-8").write(out)
print(len(out) // 1024, "KB")
