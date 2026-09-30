# WEBMCP-SPC

NXPERT EON — Enterprise Production Investigation & Monitoring platform.
Modernization of the legacy manufacturing execution system (MES).

## Clone

```bash
git clone https://github.com/Johnell-Empuerto/WEBMCP-SPC.git
cd WEBMCP-SPC
```

Monorepo layout:

```
WEBMCP-SPC/
├── backend/                 # Express + TypeScript API (:3002)
│   ├── src/
│   │   ├── config/          # env validation, SQL Server pool
│   │   ├── controllers/     # request handlers
│   │   ├── services/        # business logic
│   │   ├── repositories/    # data access (mssql)
│   │   ├── routes/          # /api route definitions
│   │   ├── middleware/      # auth (JWT), validation, errors
│   │   └── types/           # shared API/model types
│   └── assets/templates/    # Excel upload templates
├── frontend/                # React + TypeScript SPA (:5173)
│   ├── src/
│   │   ├── api/             # axios client
│   │   ├── auth/            # AuthProvider, permissions
│   │   ├── components/      # layout, login, ui primitives, MCP chat panel
│   │   ├── features/        # one folder per page/feature
│   │   └── webmcp/          # tool registry, /chat client, executor
│   └── public/              # logos, static assets
└── laya-server/             # Laya intent + chat orchestrator, FastAPI (:9000)
    ├── server.py            # POST /predict, /intent, /chat
    ├── orchestrator.py      # tool chain, clarify state
    ├── qwen.py              # Qwen tool-selection client (:9001)
    ├── tools.py             # registry mirror + validation
    └── test_*.py            # choose / qwen / chat smoke tests
```

## What You Need to Download

| Tool | Version | Used for |
| ---- | ------- | -------- |
| [Git](https://git-scm.com/downloads) | any recent | cloning the repo |
| [Node.js](https://nodejs.org/) | 20+ (npm 10+) | frontend + backend |
| [Python](https://www.python.org/downloads/) | 3.10+ | laya-server (FastAPI) |
| pip packages | — | `pip install fastapi uvicorn pydantic` plus the `laya` NLU package (imported by `laya-server/server.py`) |
| [llama.cpp](https://github.com/ggml-org/llama.cpp) | recent | `llama-server` hosting the tool-selection model |
| Qwen3-0.6B (GGUF) | ~0.6B | the model `llama-server` serves on `:9001` |
| Microsoft SQL Server | any | application database (default host: `iot-server`) |

## Technology Stack

| Layer    | Technology                                                     |
| -------- | -------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Radix UI, Recharts |
| Data     | TanStack Query, Axios, React Hook Form + Zod                    |
| Backend  | Express 4, TypeScript, Zod, Helmet, rate limiting               |
| Database | Microsoft SQL Server (mssql)                                   |
| Auth     | JWT access + refresh tokens, bcrypt                            |
| AI       | Laya intent router (Python/FastAPI), Qwen3-0.6B via llama-server |
| Tooling  | tsx (dev), ESLint (backend), oxlint (frontend)                 |

## Features

- **Authentication & authorization** — JWT login, role-based permissions, session timeout
- **NXPERT MCP chat assistant** — right-side chat panel that drives the app: page navigation, DPR filters, data loading (`navigateToDPR` → `setDPRFilters` → `searchDPR`), with a Guide page at `/mcp-guide`
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

- Git, Node.js 20+, npm 10+
- Python 3.10+ (FastAPI, uvicorn, pydantic, the `laya` package)
- llama.cpp `llama-server` + a Qwen3-0.6B GGUF model
- Microsoft SQL Server (default host: `iot-server`)

## Getting Started

### 1. Clone

```bash
git clone https://github.com/Johnell-Empuerto/WEBMCP-SPC.git
cd WEBMCP-SPC
```

### 2. Backend

```bash
cd backend
npm install
copy .env.example .env     # then fill DB_PASSWORD and JWT_SECRET
npm run dev                # http://localhost:3002
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

### 4. Laya server (intent + chat orchestrator)

```bash
cd laya-server
python server.py           # http://127.0.0.1:9000
```

### 5. Qwen tool selector (llama-server)

```bash
llama-server -m <qwen3-0.6b.gguf> --port 9001
```

The frontend Vite dev server proxies traffic (see `frontend/vite.config.ts`):

| Prefix      | Target                     | Notes                          |
| ----------- | -------------------------- | ------------------------------ |
| `/api`      | `http://localhost:3002`    | Express API                    |
| `/laya-api` | `http://localhost:9000`    | prefix stripped (`/laya-api/chat` → `/chat`) |

Ports at a glance:

| Service            | Port | Start command                     |
| ------------------ | ---- | --------------------------------- |
| Frontend (Vite)    | 5173 | `npm run dev` in `frontend/`      |
| Backend (Express)  | 3002 | `npm run dev` in `backend/`       |
| Laya (FastAPI)     | 9000 | `python server.py` in `laya-server/` |
| Qwen (llama-server)| 9001 | `llama-server -m … --port 9001`   |

The chat degrades gracefully: `/intent` and the UI work without llama-server; tool selection (`/chat`) needs it.

### Smoke tests (laya-server)

```bash
python test_choose.py    # registry/validate_choice
python test_qwen.py      # Qwen tool selection (needs :9001)
python test_chat.py      # full /chat chain (needs :9000 + :9001)
```

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

### Laya server (`laya-server/`)

| Variable       | Default                        | Description                       |
| -------------- | ------------------------------ | --------------------------------- |
| `QWEN_URL`     | `http://127.0.0.1:9001/v1/chat/completions` | Tool-selection endpoint |
| `QWEN_MODEL`   | `qwen3-0.6b`                   | Model name sent to llama-server   |
| `QWEN_TIMEOUT` | `60`                           | Seconds before a tool call fails  |
| `LAYA_PRELOAD` | `0`                            | `1` builds intent checkpoints at startup |

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
| `python server.py` (laya)     | Intent + chat API on :9000       |
| `python test_chat.py` (laya)  | Chat pipeline smoke test         |

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

Laya server exposes: `POST /predict`, `POST /intent`, `POST /chat`, plus `GET /qtypes`, `/models`, `/health`.

## Documentation

- `frontend/doc/architecture.md` — architecture overview
- `frontend/docs/PRODUCTION-DATA-FLOW.md` — production data flow

## Project Status

Under active modernization. Stage 1 (production security & foundation) is complete. Architecture consistency (Route → Controller → Service → Repository) is the next stage, performed module-by-module with behavior preservation.
