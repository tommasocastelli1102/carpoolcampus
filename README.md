# CarpoolCampus

**Commute Together, Share the Ride, Split the Cost.**

An MVP "Uber for student carpooling" — connects student drivers with empty
seats to student riders who need a cheaper, easier way to get to campus.

This is a demo build: authentication is email/password + JWT (no real
OAuth), and payments are **not processed** — the app only records a payment
method preference and whether payment happened.

## Stack

- **Backend:** Python, FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic, JWT auth (python-jose + passlib/bcrypt)
- **Frontend:** React (Vite), React Router, plain CSS (Uber-inspired dark navy/blue theme)
- **Database:** PostgreSQL (managed locally via pgAdmin)
- **Realtime chat:** WebSockets, with automatic polling fallback

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (a local server) + [pgAdmin](https://www.pgadmin.org/) to manage it

## 1. Create the database (pgAdmin)

1. Open pgAdmin and connect to your local PostgreSQL server.
2. Right-click **Databases → Create → Database…**
3. Name it `carpoolcampus` (or anything you like — just match it in `.env` below) and save.

That's it — the backend creates all tables automatically on first run (see
"Schema" note below), so no manual SQL is required.

## 2. Backend setup

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env` (gitignored — never commit real credentials) with your
DB connection string and a JWT secret:

```
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/carpoolcampus
JWT_SECRET=some-random-string-for-local-dev
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Run the API (tables are created automatically on startup from the SQLAlchemy
models):

```bash
uvicorn app.main:app --reload --port 8000
```

Then seed some demo data (5 drivers, 5 riders, availability, a sample
confirmed ride with chat + review, and one pending request):

```bash
python seed.py
```

Demo login for any seeded user is `password123`, e.g.:

- Driver: `maya.driver@ucla.edu` / `password123`
- Rider: `alex.rider@ucla.edu` / `password123`

The API is now running at `http://localhost:8000` (interactive docs at
`http://localhost:8000/docs`).

### Schema note (Alembic)

For this MVP, `app/main.py` calls `Base.metadata.create_all()` on startup,
which is the simplest way to get the schema into a fresh database. An initial
Alembic migration is also included at `backend/alembic/versions/` for when
this moves past local demo use and needs real, tracked schema changes —
apply it instead with:

```bash
alembic upgrade head
```

(Don't run both `create_all` and a fresh `alembic upgrade head` against the
same empty database twice — either is sufficient on its own for a new DB.)

## 3. Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api/*` requests
to the backend at `http://localhost:8000`, so no CORS setup is needed for
local dev (the backend's `.env` already lists `http://localhost:5173` in
`CORS_ORIGINS` in case you call it directly).

## Deploying to Render

`render.yaml` at the repo root is a Render "blueprint" that provisions all
three pieces in one go: the FastAPI backend, a Postgres database, and the
built React frontend as a static site.

1. Push this repo to GitHub if you haven't already (it already lives at
   `github.com/tommasocastelli1102/carpoolcampus`).
2. Go to [render.com](https://render.com) and sign up/sign in with GitHub —
   no separate password to manage. The free tier needs no credit card.
3. **New → Blueprint**, pick the `carpoolcampus` repo. Render reads
   `render.yaml` and shows you the three services it's about to create —
   click **Apply**.
4. First deploy takes a few minutes (installing Python + Node deps,
   building the frontend, provisioning Postgres). The backend creates its
   own tables automatically on first boot (same `Base.metadata.create_all()`
   used locally — see the Schema note above), so there's no separate
   migration step for a fresh database.
5. Once live, open the backend service's **Shell** tab in the Render
   dashboard and run `python seed.py` if you want the same demo data
   (5 drivers, 5 riders, sample ride + review) as local dev.
6. Grab the frontend's `https://carpoolcampus-frontend.onrender.com`-style
   URL from its Render page — that's your live app.

**If the service names were already taken** (Render then suffixes yours,
e.g. `carpoolcampus-backend-ab12`): open the backend service's
**Environment** tab and update `CORS_ORIGINS` to match your real frontend
URL, then open the frontend service's **Environment** tab and update
`VITE_API_BASE_URL` to match your real backend URL — trigger a manual
redeploy on the frontend afterward so the new build picks it up (Vite bakes
that value in at build time, not runtime).

**Free-tier notes:**
- The backend spins down after 15 minutes idle; the next request wakes it
  up but takes ~30–50s. Fine for a demo, noticeable if a grader hits it cold.
- Render's free Postgres plan is free for a limited window (check current
  terms at signup) before it either needs upgrading (~$7/mo) or gets
  deleted — the schema/seed script can always recreate it from scratch if
  that happens.
- A custom domain (if you buy one later) attaches to the **frontend**
  static site for free — no plan upgrade needed. Add your domain's URL to
  the backend's `CORS_ORIGINS` afterward or API calls from it will be
  blocked.

## Project structure

```
backend/
  app/
    main.py          FastAPI app, CORS, router registration
    config.py         Settings from environment / .env
    database.py        SQLAlchemy engine/session
    models.py           ORM models (users, driver_profiles, availability,
                          rides_requests, messages, reviews)
    schemas.py            Pydantic request/response models
    security.py             Password hashing + JWT
    deps.py                  Shared FastAPI dependencies (get_current_user)
    routers/                  auth, availability, rides, messages, reviews, users
  alembic/                     Migrations (see Schema note above)
  seed.py                        Demo data seed script
  requirements.txt
  .env                            Local config (gitignored — create it yourself, see setup above)

frontend/
  src/
    pages/             Home, AuthPage, RiderDashboard, DriverDashboard, ChatPage, ReviewPage
    components/          Navbar, ProtectedRoute, ComingSoonModal, StarRating
    context/               AuthContext (JWT stored in localStorage)
    api/                     Axios client
    styles/                   theme.css — dark navy/blue design tokens
  vite.config.js
  .env.example
```

## What's mocked / stubbed for this MVP

- **"Log in with Bruin Account"** — shows a "We're working on it! Available soon." modal, no real OAuth.
- **Driver "Request Edit"** on an incoming ride request — same "Available soon." modal.
- **Payments** (Venmo, cash, beer, aux cord, coffee, other) — stored as text/enum only; no real transaction ever happens.
- **Audio review upload** — accepts a file in the browser but doesn't upload, transcribe, or process it.

## Known MVP limitations

- Real-time chat state (the WebSocket connection manager) lives in the
  backend process's memory — fine for a single local `uvicorn` process, but
  won't fan out across multiple backend instances. Polling
  (`GET /messages/{id}`) is used as an automatic fallback and always works
  regardless.
- Ride sorting on the driver dashboard approximates "soonest first" using
  each request's custom time or its recurring slot's time-of-day, since
  recurring availability isn't tied to a specific calendar date.
- The UCLA Anderson parking permit figure on the home page cites the general
  UCLA Transportation student commuter rate (UCLA Anderson doesn't publish a
  separate one) — flagged as a TODO to confirm against the latest
  fiscal-year rate sheet before this goes anywhere near production.
