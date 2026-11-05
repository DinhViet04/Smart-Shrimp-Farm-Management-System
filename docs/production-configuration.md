# Production configuration

Never commit `.env`, `.env.production`, SMTP passwords, database passwords,
JWT secrets, OpenAI keys, or seed passwords. Commit only the provided
`.env.example` templates.

## Docker deployment

Create the server-only environment file from the root template, then replace
every placeholder before starting the stack:

```bash
cp .env.example .env.production
docker compose --env-file .env.production -f docker-compose.production.yml config
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
docker compose --env-file .env.production -f docker-compose.production.yml --profile seed run --rm seed
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

Only Nginx is published to the host. PostgreSQL, the backend, and the AI
service stay on private Docker networks. PostgreSQL data and AI data are kept
in the named volumes `postgres_data` and `ai_data`.

The provided Nginx configuration listens on HTTP. Terminate TLS with a VPS
reverse proxy or add the domain certificate before exposing the service to
production traffic.

## 1. Backend

Copy `backend/.env.example` to `backend/.env.production` on the server and
replace every placeholder. The backend validates required production values at
startup and refuses weak/reused JWT secrets, non-HTTPS CORS origins, and
unreplaced template values.

Generate two independent JWT secrets:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

- `DATABASE_URL` is used by the running API.
- `DIRECT_URL` is used by Prisma migrations. On a self-hosted VPS it can be the
  same URL; managed database pools usually require a separate direct URL.
- Percent-encode special characters in database usernames and passwords.
- `FRONTEND_URL` is the canonical web origin, without a trailing slash.
- `CORS_ORIGINS` is a comma-separated HTTPS allowlist, also without trailing
  slashes. Native APK requests do not require a browser CORS origin.
- Keep `TRUST_PROXY=true` when the API is behind Nginx or another reverse proxy.

Use the environment file through Docker/Compose, systemd, or the process
manager. Do not rely on committing it to the repository.

## 2. Google login

Use one Google OAuth Web Client ID for the backend and web frontend:

- Backend: `GOOGLE_CLIENT_ID`
- Web: `VITE_GOOGLE_CLIENT_ID`

In Google Cloud Console, add the real web domain (for example
`https://app.example.com`) to Authorized JavaScript origins. Never configure a
client secret in the browser bundle.

## 3. SMTP

SMTP is required for staff invitations and password-reset OTPs. For Gmail, use
an App Password instead of the normal Google account password. Typical Gmail
settings are port `587` with `SMTP_SECURE=false`, or port `465` with
`SMTP_SECURE=true`.

## 4. Bootstrap Admin

Before the first seed, set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and
optionally `SEED_ADMIN_NAME`, then run:

```bash
cd backend
npm run db:migrate:deploy
npm run db:seed
```

Remove the seed password from the long-running application environment after
the Admin has been created and change the bootstrap password after first login.

## 5. Web, mobile, and AI

- Copy `frontend-web/.env.example` to `frontend-web/.env.production` before the
  production web build. `VITE_*` values are public and embedded into the bundle.
- Set `EXPO_PUBLIC_API_URL=https://api.example.com` in the EAS production
  environment before creating an APK/AAB.
- `OPENAI_API_KEY` is optional. Without it, the backend and AI service use their
  configured local fallback behavior.
- If deploying `ai-service`, set its `CORS_ORIGINS` as a JSON array of exact
  HTTPS origins. Do not use `*` with credentialed requests.
