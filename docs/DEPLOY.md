# Deploying a generated site (Docker + Traefik)

Only deploy when the user asks. The default deliverable is a local demo.

## One-time server setup
```bash
docker --version && docker compose version          # install if missing
docker network create traefik
mkdir -p /opt/traefik && cd /opt/traefik            # compose file below, then:
docker compose up -d
```
```yaml
services:
  traefik:
    image: traefik:v3.1
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.le.acme.httpchallenge=true"
      - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.le.acme.email=YOU@EXAMPLE.COM"
      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"
    ports: ["80:80", "443:443"]
    volumes: ["/var/run/docker.sock:/var/run/docker.sock:ro", "letsencrypt:/letsencrypt"]
    networks: [traefik]
    restart: unless-stopped
networks: { traefik: { external: true } }
volumes: { letsencrypt: {} }
```

## Per site
1. **DNS first.** Point an A record for the domain or subdomain (for example `demo.clientdomain.com`) at the server. Let's Encrypt cannot issue a certificate until it resolves.
2. Edit `docker-compose.yml`: set the router rule host, e.g. `Host(\`demo.clientdomain.com\`)`, and the router and service names to the project slug.
3. Set `SITE_URL=https://demo.clientdomain.com` in `.env` (canonical URLs, sitemap and schema use it).
4. Copy the project to the server (`rsync -avz --exclude node_modules --exclude .git ./ user@host:/opt/sites/<slug>/`), then `docker compose up -d --build`. The `data/` folder is a volume, so leads and chats survive rebuilds.
5. Check: `https://<host>/` loads with a valid certificate, `/admin.html` shows the login, `GET /api/leads` returns 401 (the backend is running), `docker ps` shows the container healthy.

## Notes
- Rebuild with `--build` after any change to code, config or content.
- Keep `.env` on the server only. Rotate any key that was ever pasted into a chat.
- Set `RESEND_API_KEY` and `RESEND_FROM` (a verified domain) for lead alerts and deposit emails; `STRIPE_SECRET_KEY` (and `STRIPE_WEBHOOK_SECRET` pointing at `/api/stripe-webhook`) for deposits.
