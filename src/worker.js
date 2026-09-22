/**
 * Cloudflare Worker for michalsampson.co.il
 *
 * - Static site is served from ./public via Workers Static Assets (see wrangler.jsonc).
 * - POST /api/lead accepts the contact and intake forms and emails them to Michal.
 *
 * Secrets / vars (set with `wrangler secret put` or in the dashboard):
 *   RESEND_API_KEY  - required for email delivery (https://resend.com)
 *   LEAD_TO         - recipient, default micsam4@gmail.com
 *   LEAD_FROM       - verified sender, e.g. "אתר מיכל סמפסון <site@michalsampson.co.il>"
 *
 * Without RESEND_API_KEY the endpoint returns 503 and the front end falls back to
 * a prefilled WhatsApp message, so no lead is ever silently lost.
 */

const MAX_BODY = 16 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const recent = new Map(); // ip -> timestamps (best-effort, per isolate)

const LABELS = {
  name: 'שם', phone: 'טלפון', email: 'אימייל', preferred_contact: 'דרך התקשרות מועדפת',
  service: 'סוג הפנייה', message: 'הודעה', age: 'גיל', location: 'עיר ומדינה', timezone: 'אזור זמן',
  participants: 'משתתפים', reason: 'מה מביא לטיפול', goals: 'מטרות', history: 'ניסיון טיפולי קודם',
  health: 'חשוב לדעת מראש', support: 'סביבה תומכת', availability: 'זמינות', emergency_contact: 'איש קשר לחירום',
  consent: 'אישור תנאים', page: 'עמוד',
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function rateLimited(ip) {
  const now = Date.now();
  const list = (recent.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  list.push(now);
  recent.set(ip, list);
  if (recent.size > 5000) recent.clear();
  return list.length > RATE_MAX;
}

async function readBody(request) {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const text = await request.text();
    if (text.length > MAX_BODY) throw new Error('too_large');
    return JSON.parse(text);
  }
  const form = await request.formData();
  const out = {};
  for (const [k, v] of form.entries()) out[k] = typeof v === 'string' ? v : '';
  return out;
}

function validate(body) {
  const clean = {};
  for (const k of Object.keys(LABELS)) {
    const v = body[k];
    if (v == null) continue;
    clean[k] = String(v).trim().slice(0, k === 'reason' ? 4000 : 2000);
  }
  clean.type = body.type === 'intake' ? 'intake' : 'lead';
  if (body.website) return { error: 'spam' }; // honeypot
  if (!clean.name || clean.name.length < 2) return { error: 'missing_name' };
  if (!clean.phone || clean.phone.replace(/\D/g, '').length < 7) return { error: 'missing_phone' };
  if (clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) return { error: 'bad_email' };
  if (clean.type === 'intake' && (!clean.reason || clean.reason.length < 10)) return { error: 'missing_reason' };
  return { clean };
}

function render(clean, meta) {
  const title = clean.type === 'intake' ? 'שאלון היכרות חדש מהאתר' : 'פנייה חדשה מהאתר';
  const rows = [];
  for (const k of Object.keys(LABELS)) {
    if (clean[k]) rows.push([LABELS[k], clean[k]]);
  }
  rows.push(['התקבל', meta.when]);
  const text = [title, '', ...rows.map(([l, v]) => `${l}: ${v}`)].join('\n');
  const html = `<!doctype html><html dir="rtl" lang="he"><body style="font-family:Arial,sans-serif;font-size:15px;color:#143b3a">
<h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>
<table cellpadding="6" style="border-collapse:collapse">${rows
    .map(([l, v]) => `<tr><td style="font-weight:bold;vertical-align:top;border-bottom:1px solid #e2ece9;white-space:nowrap">${escapeHtml(l)}</td><td style="border-bottom:1px solid #e2ece9;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`)
    .join('')}</table>
${clean.phone ? `<p><a href="https://wa.me/${escapeHtml(clean.phone.replace(/\D/g, '').replace(/^0/, '972'))}">פתיחת וואטסאפ עם הפונה</a></p>` : ''}
</body></html>`;
  return { subject: `${title}: ${clean.name}${clean.service ? ' · ' + clean.service : ''}`, text, html };
}

async function sendEmail(env, mail, replyTo) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.LEAD_FROM || 'אתר מיכל סמפסון <onboarding@resend.dev>',
      to: [env.LEAD_TO || 'micsam4@gmail.com'],
      reply_to: replyTo || undefined,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  });
  if (!res.ok) throw new Error(`resend_${res.status}: ${await res.text()}`);
}

async function handleLead(request, env) {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (rateLimited(ip)) return json(429, { error: 'rate_limited' });

  let body;
  try {
    body = await readBody(request);
  } catch (e) {
    return json(400, { error: 'bad_request' });
  }
  const { clean, error } = validate(body);
  if (error === 'spam') return json(200, { ok: true }); // pretend success for bots
  if (error) return json(422, { error });

  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set; lead not emailed', clean.type, clean.name);
    return json(503, { error: 'email_not_configured' });
  }

  const when = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  const mail = render(clean, { when });
  try {
    await sendEmail(env, mail, clean.email);
  } catch (e) {
    console.error(String(e));
    return json(502, { error: 'email_failed' });
  }
  return json(200, { ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/lead') return handleLead(request, env);
    if (url.pathname.startsWith('/api/')) return json(404, { error: 'not_found' });
    // Anything else: static assets (with _redirects/_headers/404.html handled by the assets binding).
    return env.ASSETS.fetch(request);
  },
};
