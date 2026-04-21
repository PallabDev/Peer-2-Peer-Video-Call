# Callie Backend

Node.js + Express + Drizzle backend for a permissioned one-to-one audio/video calling app.

## Features

- email + password authentication with `scrypt` password hashing
- email verification and password reset via Resend
- admin-controlled access approval and role management
- Expo push token registration for incoming call alerts
- Socket.IO signaling for WebRTC peer-to-peer calls
- PostgreSQL schema for users, tokens, and call history

## Local setup

1. Copy `.env.example` to `.env`
2. Start Postgres

```bash
docker compose up -d
```

3. Install dependencies

```bash
npm install
```

4. Run migrations and start the API

```bash
npm run db:migrate
npm run dev
```

## Render notes

- Host this backend as a web service on Render
- Keep `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, and `EMAIL_FROM` in Render environment variables
- Render can host signaling + API, but reliable WebRTC across mobile networks still needs TURN credentials
