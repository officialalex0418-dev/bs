# Business Sarthi — Deployment Guide

## 0. Prerequisites
- MongoDB Atlas account
- Render account (backend)
- Vercel account (frontend)
- Gmail account with **App Password** (or any SMTP provider — SendGrid/SES recommended at scale)
- Google Cloud project with **Maps JavaScript API** enabled

> 🔐 **Never commit `.env`.** If a credential has ever been pasted into chat, a ticket,
> or a repo — rotate it immediately (Gmail → Security → App Passwords → revoke).

---

## 1. MongoDB Atlas
1. Create a project → build an **M0 (dev) / M10+ (prod)** cluster.
2. **Database Access** → add user with `readWrite` on `business_sarthi`.
3. **Network Access** → allow `0.0.0.0/0` (Render uses dynamic IPs) — rely on strong
   credentials + TLS, or use Atlas Private Endpoint on paid tiers.
4. Copy the connection string:
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/business_sarthi?retryWrites=true&w=majority`
5. Indexes are created automatically in dev (`autoIndex`). For production run once:
   ```js
   // mongosh or a migration step
   db.getCollectionNames().forEach(c => db[c].reIndex && null);
   // or from node: mongoose.connection.syncIndexes()
   ```

## 2. Backend → Render
1. Push the repo to GitHub.
2. Render → **New → Web Service** → pick repo, root dir `backend`.
3. Settings:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/health`
4. Environment variables (Render dashboard → Environment):
   ```
   NODE_ENV=production
   PORT=10000                      # Render injects PORT; app reads it
   MONGO_URI=<atlas uri>
   CLIENT_URL=https://your-app.vercel.app
   JWT_ACCESS_SECRET=<64+ random chars>     # openssl rand -hex 64
   JWT_REFRESH_SECRET=<different 64+ chars>
   JWT_ACCESS_EXPIRES=15m
   JWT_REFRESH_EXPIRES=7d
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   EMAIL_USER=<your gmail>
   EMAIL_PASS=<NEW app password — rotate any leaked one>
   EMAIL_FROM="Business Sarthi <your gmail>"
   GOOGLE_MAPS_API_KEY=<server key, optional>
   ```
5. Deploy → note the URL, e.g. `https://business-sarthi-api.onrender.com`.
6. Seed once (Render → Shell): `npm run seed`.

**WebSockets:** Render supports them natively — no extra config; Socket.io works
on the same service/port.

## 3. Frontend → Vercel
1. Vercel → **New Project** → import repo, root dir `frontend`.
2. Framework preset: **Vite**. Build `npm run build`, output `dist`.
3. Environment variables:
   ```
   VITE_API_URL=https://business-sarthi-api.onrender.com
   VITE_GOOGLE_MAPS_API_KEY=<browser key>
   ```
4. Add a SPA rewrite — `frontend/vercel.json`:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
5. Deploy. Then set the backend's `CLIENT_URL` to your Vercel domain (CORS + cookies).

> Cross-site cookies: the refresh cookie is `SameSite=None; Secure` in production,
> and the frontend also sends the refresh token in the body as a fallback, so
> Vercel↔Render cross-origin refresh works either way.

## 4. Google Maps keys
- **Browser key** (frontend): restrict by HTTP referrer (`https://your-app.vercel.app/*`),
  enable *Maps JavaScript API*. Used by `@react-google-maps/api` incl. heatmap (visualization library).
- **Server key** (optional, backend geocoding later): restrict by IP.

## 5. Gmail App Password (Nodemailer)
1. Enable 2-Step Verification on the Google account.
2. https://myaccount.google.com/apppasswords → create app password → put in `EMAIL_PASS`.
3. Gmail limit ≈ 500 mails/day — switch to SendGrid/SES/Postmark in production
   (only `SMTP_HOST/PORT/USER/PASS` change).

## 6. Docker (self-hosting alternative)
```bash
cd business-sarthi
cat > .env <<'EOF'
JWT_ACCESS_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
EMAIL_USER=
EMAIL_PASS=
VITE_GOOGLE_MAPS_API_KEY=
EOF
docker compose up -d --build
# web → http://localhost:8080 · api → http://localhost:5000 · mongo → 27017
docker compose exec api node src/seed/seed.js
```

## 7. Post-deploy checklist
- [ ] `GET /health` returns `{"status":"ok"}`
- [ ] Seeded super admin login works, then **change its password**
- [ ] Forgot-password email arrives
- [ ] Staff login → location ping appears on company Live Tracking map in real time
- [ ] Excel + PDF report downloads work
- [ ] Rotate any credential that was ever shared in plaintext
- [ ] Enable Atlas backups + alerts (connections, disk, slow queries)

## 8. Future Scalability Recommendations
1. **Location ingestion at scale** (10k staff × 48 pings/day ≈ 500k docs/day):
   - Move ingestion behind a queue (BullMQ + Redis); API enqueues, worker bulk-inserts.
   - Convert `locationlogs` to a **MongoDB time-series collection**.
   - Atlas Online Archive for pings older than 90–180 days (TTL already in place).
2. **Horizontal API scaling:** Render autoscaling + `socket.io` Redis adapter
   (`@socket.io/redis-adapter`) so rooms work across instances.
3. **Caching:** Redis for dashboard aggregates (30–60 s TTL) and package/feature lookups.
4. **Background jobs:** node-cron/BullMQ for scheduled payroll, daily absent-marking,
   package-expiry checks, email digests.
5. **Mobile:** wrap staff app in **Capacitor/React Native** for true background tracking
   (Android ForegroundService, iOS Always-location); reuse the same `/locations` batch API.
6. **Files:** move logos/photos to S3/Cloudinary signed uploads (URLs already supported).
7. **Observability:** pino structured logs, Sentry, OpenTelemetry traces, Atlas Performance Advisor.
8. **Security hardening:** 2FA for owners/admins, IP allowlists per company,
   secrets manager (Doppler/AWS SM), per-tenant rate limits, CSP headers on frontend.
9. **Billing:** integrate Stripe/Khalti/eSewa subscriptions driving `Company.packageExpiresAt`,
   with a cron downgrading expired companies.
10. **Data isolation upsell:** for enterprise customers, support dedicated databases
    per tenant behind the same API (connection registry keyed by company).
