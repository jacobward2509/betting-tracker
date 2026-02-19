# Environment Setup (Dev Only)

This project is now configured to run environment-driven for **Dev**.

## 1) API env

Create:
- `/Users/jacob.ward/Desktop/Repos/betting-tracker/apps/api/.env`

From:
- `/Users/jacob.ward/Desktop/Repos/betting-tracker/apps/api/.env.example`

Set:
- `DATABASE_URL` = your new Dev Supabase Postgres URL
- `PORT=3000`
- `CORS_ORIGIN=http://localhost:5173`

## 2) Web env

Create:
- `/Users/jacob.ward/Desktop/Repos/betting-tracker/apps/web/.env`

From:
- `/Users/jacob.ward/Desktop/Repos/betting-tracker/apps/web/.env.example`

Set:
- `VITE_API_BASE_URL=http://localhost:3000`

## 3) Apply DB migrations (Dev project)

From:
- `/Users/jacob.ward/Desktop/Repos/betting-tracker/apps/api`

Run:
- `npx prisma migrate deploy`
- `npx prisma generate`

## 4) Run locally

From repo root:
- `npm run dev`

This starts:
- Web (Vite)
- API (Express)

## Notes

- Browser clients never connect directly to DB. They call the API.
- DB access is restricted to server-side via `DATABASE_URL`.
- CORS is restricted by `CORS_ORIGIN`.
