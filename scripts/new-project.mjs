#!/usr/bin/env node
// Scaffold a runnable contractor site from the template.
//   node scripts/new-project.mjs --out <dir> --config <config.json> [--images <dir>] [--pages <pages.json>]
//                                [--password <admin password>] [--install]
// Secrets: DEEPSEEK_API_KEY (and optional STRIPE_SECRET_KEY / RESEND_API_KEY) are read from the environment
// and written to <dir>/.env, which is gitignored. They are never written anywhere else.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? acc.concat([[a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]]) : acc), []));
if (!args.out || !args.config) { console.error('usage: new-project.mjs --out <dir> --config <config.json> [--images <dir>] [--pages <pages.json>] [--password <pw>] [--install]'); process.exit(1); }

const out = path.resolve(args.out);
const cfgPath = path.resolve(args.config);
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

function copyDir(src, dst, skip = []) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.includes(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d, skip); else fs.copyFileSync(s, d);
  }
}

copyDir(path.join(root, 'template'), out, ['node_modules', 'data', '.env']);
fs.mkdirSync(path.join(out, 'content', 'site'), { recursive: true });
fs.copyFileSync(cfgPath, path.join(out, 'content', 'config.json'));
if (args.images) copyDir(path.resolve(args.images), path.join(out, 'public', 'images'));
if (args.pages) fs.copyFileSync(path.resolve(args.pages), path.join(out, 'content', 'site', 'pages.json'));

/* .env: secrets come from the environment, admin password is random unless supplied */
const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomPw = () => Array.from(crypto.randomBytes(16)).map((x) => alphabet[x % alphabet.length]).join('');
const password = typeof args.password === 'string' ? args.password : randomPw();
const env = [
  '# Secrets. Never commit this file.',
  'ADMIN_PASSWORD_HASH=' + crypto.createHash('sha256').update(password).digest('hex'),
  'SESSION_SECRET=' + crypto.randomBytes(32).toString('hex'),
  'SITE_URL=' + (cfg.site && cfg.site.siteUrl ? cfg.site.siteUrl : ''),
  'SITE_SLUG=' + String((cfg.business && cfg.business.name) || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  'SITE_HOST=' + (() => { try { return new URL(cfg.site.siteUrl).hostname; } catch (e) { return 'localhost'; } })(),
  'DEEPSEEK_API_KEY=' + (process.env.DEEPSEEK_API_KEY || ''),
  'DEEPSEEK_MODEL=deepseek-chat',
  'DEEPSEEK_BASE_URL=https://api.deepseek.com',
  'STRIPE_SECRET_KEY=' + (process.env.STRIPE_SECRET_KEY || ''),
  'RESEND_API_KEY=' + (process.env.RESEND_API_KEY || ''),
  'RESEND_FROM=',
  'NOTIFY_EMAIL=' + ((cfg.business && cfg.business.email) || ''),
  ''
].join('\n');
fs.writeFileSync(path.join(out, '.env'), env);
fs.writeFileSync(path.join(out, '.admin-password.txt'), password + '\n');
fs.writeFileSync(path.join(out, '.gitignore'), 'node_modules/\n.env\n.admin-password.txt\ndata/*.json\n*.log\nqa-shots/\n');
fs.writeFileSync(path.join(out, '.env.example'), env.split('\n').map((l) => (/^(ADMIN_PASSWORD_HASH|SESSION_SECRET|DEEPSEEK_API_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY)=/.test(l) ? l.split('=')[0] + '=' : l)).join('\n'));

if (args.install) { console.log('npm install ...'); execSync('npm install --omit=dev', { cwd: out, stdio: 'inherit' }); }
console.log(`\nProject ready: ${out}`);
console.log(`Admin password: ${password}   (also saved in .admin-password.txt, gitignored)`);
console.log(process.env.DEEPSEEK_API_KEY ? 'DeepSeek key: found in environment and written to .env' : 'DeepSeek key: NOT set. Add DEEPSEEK_API_KEY to .env for AI chat (scripted fallback works without it).');
console.log(`Run it:  cd "${out}" && npm install && npm start`);
