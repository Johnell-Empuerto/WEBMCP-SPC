# WEBMCP-SPC

NXPERT EON — Enterprise Production Investigation & Monitoring platform for Isuzu.
Modernization of the legacy manufacturing execution system (MES).

Monorepo layout:

```
WEBMCP-SPC/
├── backend/                 # Express + TypeScript API
│   ├── src/
│   │   ├── config/          # env validation, SQL Server pool
│   │   ├── controllers/     # request handlers
│   │   ├── services/        # business logic
│   │   ├── repositories/    # data access (mssql)
│   │   ├── routes/          # /api route definitions
│   │   ├── middleware/      # auth (JWT), validation, errors
│   │   └── types/           # shared API/model types
│   └── assets/templates/    # Excel upload templates
└── frontend/                # React + TypeScript SPA
    ├── src/
    │   ├── api/             # axios client
    │   ├── auth/            # AuthProvider, permissions
    │   ├── components/      # layout, login, ui primitives
    │   └── features/        # one folder per page/feature
    └── public/              # logos, static assets
```

## Technology Stack

| Layer    | Technology                                                     |
| -------- | -------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Radix UI, Recharts |
| Data     | TanStack Query, Axios, React Hook Form + Zod                    |
| Backend  | Express 4, TypeScript, Zod, Helmet, rate limiting               |
| Database | Microsoft SQL Server (mssql)                                   |
| Auth     | JWT access + refresh tokens, bcrypt                            |
| Tooling  | tsx (dev), ESLint (backend), oxlint (frontend)                 |

## Features

- **Authentication & authorization** — JWT login, role-based permissions, session timeout
- **Production management** — production calendar and details
- **Plan uploader** — Excel plan upload with validation log and preview
- **DPR** (Daily Production Report) — ADC / C4 / KD lines + DPR master
- **MPR** (Monthly Production Report) — ADC / C4 / KD with charts and Excel export
- **Pallet** — pallet entry (print, QR), pallet master
- **Masters** — product, kanban, locator, user, preference, shift, NG master
- **NG** — NG tagging and NG report
- **Analysis** — production charts (plan vs actual, line performance, top products)
- **Logs & settings** — audit logs and system settings (admin only)

## Prerequisites

- Node.js 20+
- npm 10+
- Microsoft SQL Server (default host: `iot-server`)

## Getting Started

### 1. Backend

```bash
cd backend
npm install
copy .env.example .env     # then fill DB_PASSWORD and JWT_SECRET
npm run dev                # http://localhost:3002
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:3002` (see `frontend/vite.config.ts`).

## Environment Variables

### Backend (`backend/.env`)

| Variable                | Default                      | Description                       |
| ----------------------- | ---------------------------- | --------------------------------- |
| `PORT`                  | `3002`                       | API port                          |
| `NODE_ENV`              | `development`                | `development` \| `production`     |
| `DB_SERVER`             | `iot-server`                 | SQL Server host                   |
| `DB_DATABASE`           | `NXPERT_EON`                 | Database name                     |
| `DB_USER`               | `sa`                         | Database user                     |
| `DB_PASSWORD`           | - (**required**)             | Database password                 |
| `DB_PORT`               | `1433`                       | Database port                     |
| `JWT_SECRET`            | - (**required**)             | JWT signing secret                |
| `JWT_EXPIRES_IN`        | `28800`                      | Access token lifetime             |
| `JWT_REFRESH_EXPIRES_IN`| `604800`                     | Refresh token lifetime            |
| `CORS_ORIGIN`           | `http://192.168.0.103:5173`  | Allowed frontend origin           |
| `NODE_RED_URL`          | `http://iot-server:1880/`    | Health check only (optional)      |
| `API_RATE_LIMIT_WINDOW_MS` | `900000`                  | Rate limit window                 |
| `API_RATE_LIMIT_MAX`    | `500`                        | Max requests per window           |

`.env` files are git-ignored — never commit real secrets. `backend/.env.example` is the tracked template.

### Frontend (`frontend/.env.development`, `frontend/.env.production`)

| Variable            | Default | Description                     |
| ------------------- | ------- | ------------------------------- |
| `VITE_API_BASE_URL` | `/api`  | API base URL (proxied via Vite) |

## Scripts

| Command                       | Description                      |
| ----------------------------- | -------------------------------- |
| `npm run dev` (backend)       | API with hot reload (tsx watch)  |
| `npm run build` (backend)     | Compile TypeScript to `dist/`    |
| `npm start` (backend)         | Run compiled server              |
| `npm run lint` (backend)      | ESLint                           |
| `npm run dev` (frontend)      | Vite dev server                  |
| `npm run build` (frontend)    | Type-check + Vite build          |
| `npm run lint` (frontend)     | oxlint                           |

## API Overview

Base path: `/api`. Health check: `GET /health` (outside `/api`).

Modules: `auth`, `analysis`, `production-management`, `production-charts`, `plan-uploader`, `dpr-adc`, `dpr-c4`, `dpr-kd`, `mpr-adc`, `mpr-c4`, `mpr-kd`, `pallet-entry`, `product-master`, `kanban-master`, `pallet-master`, `locator-master`, `user-master`, `preference-master`, `shift-master`, `ng-master`, `ng-tagging`, `ng-report`, `dpr-master`, `logs`, `health`, `settings`.

The API uses **three response envelopes** (each module family is internally consistent — do not unify them without a coordinated frontend change):

| Envelope | Shape                                                                                   | Used by                                                                       |
| -------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A        | `{ success, data?, message, errors? }`                                                  | auth, dashboard, dpr-adc/c4/kd, pallet-entry, plan-uploader, settings, health |
| B        | `{ status: 'success' \| 'error' \| 'blocked' \| 'duplicate', rows/result, totalItems }` | master modules, logs, ng-tagging, ng-report                                   |
| C        | `{ success, data }`                                                                     | mpr-adc/c4/kd, production-management, production-charts                       |

Security: Helmet, CORS (environment-driven, never `*` in production), global rate limiting on `/api/`, Zod validation, JWT middleware on protected routes.

## Documentation

- `frontend/doc/architecture.md` — architecture overview
- `frontend/docs/PRODUCTION-DATA-FLOW.md` — production data flow

## Project Status

Under active modernization. Stage 1 (production security & foundation) is complete. Architecture consistency (Route → Controller → Service → Repository) is the next stage, performed module-by-module with behavior preservation.
