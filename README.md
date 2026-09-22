# michalsampson.co.il

Hebrew, RTL, online-first therapy site for Michal Sampson. Static HTML served by
Cloudflare Workers static assets, plus one Worker route for the lead form.

## Layout

```
src/layout.html        shared <head>, header, footer, floating WhatsApp
src/partials/          header.html, footer.html, cta.html, form.html
src/pages/**/*.html    one file per page: front matter + body (goes inside <main>)
src/worker.js          POST /api/lead -> email via Resend; everything else -> assets
build.py               src/pages -> public/**/*.html + public/sitemap.xml
public/                deployed directory (generated HTML is committed)
public/_redirects      301 map from the old Folyou URLs and the July 2026 paths
wrangler.jsonc         Workers config (assets dir, html_handling, 404 page)
```

Clean URLs come from `html_handling: auto-trailing-slash`: `public/about.html`
is served at `/about`, `public/stories/index.html` at `/stories/`.

## Working on it

```bash
python3 build.py          # regenerate public/ from src/
npm install               # once, for wrangler
npm run dev               # build + wrangler dev on http://localhost:4599
npm run deploy            # build + wrangler deploy
```

Edit `src/`, never the generated HTML in `public/` (except `public/assets`,
`_redirects`, `_headers`, `robots.txt`, which are plain static files).

Page front matter keys: `title`, `description`, `priority`, `body_class`,
`og_type`, `image`, `updated`, `noindex`. Markers `<!--CTA-->` and `<!--FORM-->`
inside a page body expand to the shared partials.

## Lead form email

The Worker sends form submissions with [Resend](https://resend.com). Set once:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put LEAD_FROM     # e.g. "אתר מיכל סמפסון <site@michalsampson.co.il>" after domain verification
```

`LEAD_TO` defaults to `micsam4@gmail.com` (in `wrangler.jsonc`). If the key is
missing or Resend fails, the API returns an error and the page offers the
visitor a one-tap WhatsApp message with the same content, so nothing is lost.

## Deploy

The GitHub repo is connected to Cloudflare Workers Builds. Pushing `main`
deploys. Build command: none needed (generated HTML is committed); deploy
command: `npx wrangler deploy`.
