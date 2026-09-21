#!/usr/bin/env node
// One-time: tell the skill where to deploy. Writes ~/.redesign-contractor/server.json (outside any repo, never committed).
//   node scripts/setup-server.mjs --host 1.2.3.4 --user root --key ~/.ssh/id_ed25519 --base-domain agency.com [--github-owner name]
//                                 [--sites-dir /opt/sites] [--cert-resolver le] [--network traefik] [--cloudflare-token TOKEN]
// It then checks SSH, Docker, Compose and Traefik on the server so problems show up now, not mid-deploy.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const home = os.homedir();
const dir = path.join(home, '.redesign-contractor');
const file = path.join(dir, 'server.json');
const expand = (p) => (p || '').replace(/^~(?=$|[\\/])/, home);

let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* new */ }
const next = Object.assign({ user: 'root', port: 22, sitesDir: '/opt/sites', certResolver: 'le', network: 'traefik', keyPath: '~/.ssh/id_ed25519' }, cfg, {
  host: opt('host', cfg.host), user: opt('user', cfg.user || 'root'), port: parseInt(opt('port', cfg.port || 22), 10), keyPath: opt('key', cfg.keyPath || '~/.ssh/id_ed25519'),
  sitesDir: opt('sites-dir', cfg.sitesDir || '/opt/sites'), baseDomain: opt('base-domain', cfg.baseDomain), certResolver: opt('cert-resolver', cfg.certResolver || 'le'),
  network: opt('network', cfg.network || 'traefik'), githubOwner: opt('github-owner', cfg.githubOwner), cloudflareToken: opt('cloudflare-token', cfg.cloudflareToken)
});
if (!next.host) { console.error('--host is required (the server IP or hostname).'); process.exit(1); }

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(file, JSON.stringify(next, null, 2));
try { fs.chmodSync(file, 0o600); } catch { /* windows */ }
console.log('saved', file, next.cloudflareToken ? '(includes a Cloudflare token, keep this file private)' : '');

const ssh = (cmd) => spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=12', '-o', 'StrictHostKeyChecking=accept-new', '-i', expand(next.keyPath), '-p', String(next.port), `${next.user}@${next.host}`, cmd], { encoding: 'utf8' });
const r = ssh(`echo "host: $(hostname)"; echo "docker: $(docker --version 2>&1 | head -1)"; echo "compose: $(docker compose version 2>&1 | head -1)"; echo "network ${next.network}: $(docker network inspect ${next.network} >/dev/null 2>&1 && echo present || echo MISSING)"; echo "traefik: $(docker ps --format '{{.Names}}' | grep -i traefik | head -1 || true)"; echo "sites dir: $(test -d ${next.sitesDir} && echo present || echo MISSING)"`);
if (r.status !== 0) { console.error('SSH check failed:\n' + (r.stderr || r.stdout)); process.exit(1); }
console.log(r.stdout.trim());
const problems = [];
if (/network .*MISSING/.test(r.stdout)) problems.push(`create the network: ssh in and run "docker network create ${next.network}"`);
if (!/traefik: \S+/.test(r.stdout)) problems.push('Traefik is not running: see docs/DEPLOY.md for the one-time Traefik setup');
if (/sites dir: MISSING/.test(r.stdout)) problems.push(`create the sites folder: mkdir -p ${next.sitesDir}`);
if (!next.baseDomain) problems.push('no --base-domain set: sites will be served on <slug>.<ip>.sslip.io addresses only');
problems.forEach((p) => console.log('note:', p));
console.log(problems.length ? '\nServer reachable, with the notes above.' : '\nServer is ready for deployments.');
