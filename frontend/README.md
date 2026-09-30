# NXPERT EON

Enterprise Production Investigation & Monitoring platform.  
Modernization of the legacy manufacturing execution system.

## Repository Structure

```
isuzu-nxpert-eon/
├── eon_frontend/          # React + TypeScript + Vite frontend
├── eon_backend/           # Express + TypeScript backend
├── docs/                  # Project documentation
│   ├── architecture/      # Architecture decisions
│   ├── api/               # API documentation
│   ├── database/          # Database documentation
│   ├── modules/           # Module documentation
│   ├── migration/         # Migration plans
│   └── ui/               # UI/UX documentation
├── database/              # SQL Server scripts
│   ├── schema/            # Database schema
│   ├── procedures/        # Stored procedures
│   ├── views/             # Database views
│   ├── migrations/        # Migration scripts
│   └── scripts/           # Utility scripts
└── scripts/               # Dev/build/deploy scripts
```

## Technology Stack

| Layer    | Technology                               |
| -------- | ---------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend  | Express.js, TypeScript, MSSQL            |
| Database | Microsoft SQL Server                     |
| Auth     | JWT with refresh tokens                  |

## Prerequisites

- Node.js 20+
- npm 10+
- Microsoft SQL Server (host: `iot-server`)

## Getting Started

### Frontend

```bash
cd eon_frontend
npm install
npm run dev      # Starts dev server on http://192.168.0.103:5173
```

### Backend

```bash
cd eon_backend
npm install
npm run dev      # Starts API server on http://192.168.0.103:3002
```

## Environment Variables

### Frontend (`eon_frontend/.env.development`)

| Variable            | Default | Description                     |
| ------------------- | ------- | ------------------------------- |
| `VITE_API_BASE_URL` | `/api`  | API base URL (proxied via Vite) |

### Backend (`eon_backend/.env`)

| Variable      | Default      | Description        |
| ------------- | ------------ | ------------------ |
| `PORT`        | `3002`       | Server port        |
| `DB_SERVER`   | `iot-server` | SQL Server host    |
| `DB_DATABASE` | `NXPERT_EON` | Database name      |
| `DB_USER`     | `sa`         | Database user      |
| `DB_PASSWORD` | -            | Database password  |
| `JWT_SECRET`  | -            | JWT signing secret |

## Build Commands

```bash
# Frontend build
cd eon_frontend && npm run build

# Backend build
cd eon_backend && npm run build

# TypeScript check
cd eon_frontend && npx tsc --noEmit
cd eon_backend && npx tsc --noEmit
```

## Documentation

New to the project? Start here:

- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — beginner guide: where each layer lives, how a request flows, how auth works, how to run/validate the project, and what must not be changed without approval.
- **[`docs/SECURITY.md`](docs/SECURITY.md)** — security policy: protected routes, secrets/env rules, rate limiting, logging, database safety, transactions.
- `docs/migration/` — detailed migration plans.

## API Response Format

The API uses **three response envelopes** (each module family is internally consistent and the frontend depends on all three — do not unify them without a coordinated frontend change):

| Envelope | Shape                                                                                   | Used by                                                                       |
| -------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A        | `{ success, data?, message, errors? }`                                                  | auth, dashboard, dpr-adc/c4/kd, pallet-entry, plan-uploader, settings, health |
| B        | `{ status: 'success' \| 'error' \| 'blocked' \| 'duplicate', rows/result, totalItems }` | master modules, logs, ng-tagging, ng-report                                   |
| C        | `{ success, data }`                                                                     | mpr-adc/c4/kd, production-management, production-charts                       |

## Project Status

The system is under active modernization. Stage 1 (production security & foundation) is complete — see `docs/SECURITY.md`. Architecture consistency (Route → Controller → Service → Repository) is the next stage and is performed module-by-module with behavior preservation.
