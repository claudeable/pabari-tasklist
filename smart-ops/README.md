# Smart Ops Portal

A secure shared workspace for two organizations collaborating on water infrastructure projects — communication, documents, project coordination, decisions, tasks, meetings, engineering collaboration, site progress, and reporting. This is **not** an ERP; each organization retains its own ERP for finance/HR/procurement.

See [`docs/architecture.md`](docs/architecture.md) for the system design, [`docs/erd.md`](docs/erd.md) for the data model, [`docs/permission-matrix.md`](docs/permission-matrix.md) for RBAC, and [`docs/roadmap.md`](docs/roadmap.md) for what's built vs. planned.

## Status
Working end-to-end: **Dashboard, Organizations, Projects**, plus Auth/RBAC. The other 10 modules (Communication, Documents, Tasks, Meetings, Engineering, Site Progress, Reports, Knowledge Base, Notifications, Settings) are present in navigation as stub pages with their planned feature set, backed by a database schema that's already in place for them.

## Stack
- **Frontend**: Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Framer Motion · TanStack React Query
- **Backend**: FastAPI · SQLAlchemy · Alembic · PostgreSQL · JWT auth
- **Infra**: Docker Compose for local dev

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

Then, in a separate terminal, run migrations and seed data:

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.seed
```

- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs

The seed script prints login credentials for one user per role (all use the same demo password — see script output). Log in at http://localhost:3000/login.

## Quick start (without Docker)

**Backend**
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
# Ensure PostgreSQL is running locally and DATABASE_URL in .env points to it
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

## Repo layout
```
backend/    FastAPI app, SQLAlchemy models, Alembic migrations, seed script
frontend/   Next.js app (App Router), shadcn/ui components, React Query hooks
docs/       Architecture, ERD, permission matrix, roadmap
docker-compose.yml
```
