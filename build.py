#!/usr/bin/env python3
"""Static site build for michalsampson.co.il.

Reads src/pages/**/*.html (front-matter + body), wraps each in src/layout.html
with the shared header/footer partials, and writes the result into public/.
Also writes public/sitemap.xml. No dependencies beyond the standard library.

Usage: python3 build.py
"""
from __future__ import annotations

import re
import shutil
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
PAGES = SRC / "pages"
PARTIALS = SRC / "partials"
OUT = ROOT / "public"
SITE_URL = "https://michalsampson.co.il"

FM_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.S)


def parse_front_matter(text: str) -> tuple[dict, str]:
    m = FM_RE.match(text)
    if not m:
        raise ValueError("missing front matter")
    meta: dict[str, str] = {}
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip()
    return meta, text[m.end():]


def html_escape(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def url_for(rel: Path) -> str:
    """src/pages/services/couples.html -> /services/couples ; index.html -> / ; stories/index.html -> /stories/"""
    parts = list(rel.with_suffix("").parts)
    if parts[-1] == "index":
        parts = parts[:-1]
        return "/" + "/".join(parts) + ("/" if parts else "")
    return "/" + "/".join(parts)


def nav_key_for(url: str) -> str:
    if url == "/":
        return "home"
    return url.strip("/").split("/")[0]


def mark_active(header: str, key: str) -> str:
    # <a data-nav="services" ...> gets aria-current="page"
    return re.sub(
        rf'(<a\s+[^>]*data-nav="{re.escape(key)}"[^>]*)>',
        r'\1 aria-current="page">',
        header,
    )


def build() -> int:
    layout = (SRC / "layout.html").read_text(encoding="utf-8")
    header = (PARTIALS / "header.html").read_text(encoding="utf-8")
    footer = (PARTIALS / "footer.html").read_text(encoding="utf-8")
    cta = (PARTIALS / "cta.html").read_text(encoding="utf-8")
    form = (PARTIALS / "form.html").read_text(encoding="utf-8")

    # Remove previously generated HTML so renamed pages do not linger.
    for old in OUT.rglob("*.html"):
        old.unlink()

    urls: list[tuple[str, str, str]] = []  # (url, lastmod, priority)
    count = 0
    for src in sorted(PAGES.rglob("*.html")):
        rel = src.relative_to(PAGES)
        meta, body = parse_front_matter(src.read_text(encoding="utf-8"))
        url = url_for(rel)
        title = meta.get("title") or "מיכל סמפסון"
        description = meta.get("description", "")
        og_image = meta.get("image", "/assets/images/og-default.jpg")
        body_class = meta.get("body_class", "")
        noindex = meta.get("noindex", "").lower() in {"1", "true", "yes"}
        page_header = mark_active(header, nav_key_for(url))

        html = (
            layout.replace("{{TITLE}}", html_escape(title))
            .replace("{{DESCRIPTION}}", html_escape(description))
            .replace("{{CANONICAL}}", SITE_URL + url)
            .replace("{{OG_IMAGE}}", SITE_URL + og_image)
            .replace("{{OG_TYPE}}", meta.get("og_type", "website"))
            .replace("{{BODY_CLASS}}", body_class)
            .replace("{{ROBOTS}}", "noindex,nofollow" if noindex else "index,follow")
            .replace("{{HEADER}}", page_header)
            .replace("{{FOOTER}}", footer)
            .replace("{{CONTENT}}", body.strip().replace("<!--CTA-->", cta).replace("<!--FORM-->", form))
        )
        dest = OUT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(html, encoding="utf-8")
        count += 1
        if not noindex:
            urls.append((url, meta.get("updated", date.today().isoformat()), meta.get("priority", "0.6")))

    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>',
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url, lastmod, priority in urls:
        sitemap.append(
            f"  <url><loc>{SITE_URL}{url}</loc><lastmod>{lastmod}</lastmod><priority>{priority}</priority></url>"
        )
    sitemap.append("</urlset>\n")
    (OUT / "sitemap.xml").write_text("\n".join(sitemap), encoding="utf-8")

    print(f"built {count} pages -> {OUT.relative_to(ROOT)}/ (+ sitemap.xml, {len(urls)} urls)")
    return 0


if __name__ == "__main__":
    sys.exit(build())
