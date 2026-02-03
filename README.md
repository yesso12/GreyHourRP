# Grey Hour RP — Website

Professional cinematic site for the Grey Hour RP Project Zomboid server.

## Tech
- Vite + React + TypeScript
- Framer Motion animations
- Zero-backend admin content via JSON in `public/content/`

## Run locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```
Output goes to `dist/`.

## Content (admin friendly)
Edit these JSON files:
- `public/content/server-status.json` (online/maintenance/offline)
- `public/content/transmissions.json` (living "Transmission Intercepted")
- `public/content/updates.json` (changelog)
- `public/content/mods.json` (modpack list)
- `public/content/rules.json` (rules)
- `public/content/staff.json` (staff)

Then rebuild + redeploy.

## Optional ambient audio
Place a file at:
- `public/audio/ambient.mp3`

The navbar toggle will enable it (if file exists).

## Deploy to an IONOS VPS (Nginx)
1) Build on the VPS or locally:
```bash
npm ci
npm run build
```

2) Copy the `dist/` folder to your web root, e.g.
- `/var/www/greyhourrp`

3) Nginx config example (see below).

### Nginx config (static SPA + caching)
Create: `/etc/nginx/sites-available/greyhourrp`
```nginx
server {
  server_name YOUR_DOMAIN_HERE;

  root /var/www/greyhourrp;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location /content/ {
    add_header Cache-Control "no-store";
  }
}
```

Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/greyhourrp /etc/nginx/sites-enabled/greyhourrp
sudo nginx -t
sudo systemctl reload nginx
```

### SSL (recommended)
Use certbot (Debian/Ubuntu):
```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN_HERE
```
