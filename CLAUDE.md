# BookMySeat

FastAPI + SQLAlchemy + SQLite (dev) backend, React (Vite) + Tailwind v4 frontend.
Reference: `BookMySeat_Requirements_v4.pdf`, `bookmyseat-prototype.jsx` (original UI prototype —
the pages under `frontend/src/pages/` are split from this and wired to the real API).

## Rules (Requirements v4)
- 63 WFO slots total; the 64th WFO booking for a date returns 409 "Show Full". WFH and Leave are
  never capacity-blocked.
- Categories: WFO / WFH / L (Leave). No seat selection — WFO auto-assigns the next free slot (1-63).
- One booking per employee per date. Booking window: today + 7 days ahead.
- Weekends and manager-declared holidays are never bookable.
- Past dates are locked; editing one requires an Approved EditApproval (one-time — consumed on use).
- Manager-only: add employee, holidays, approve/reject edit requests, Excel export.

## Run it
Backend:
```
cd backend && venv\Scripts\activate
uvicorn app.main:app --reload        # http://localhost:8000/docs
pytest                               # run after any backend change
```

Frontend:
```
cd frontend
npm run dev                          # http://localhost:5173
```

Seed dev data (3 teams, 70 employees, 1 manager — all password `password123`):
```
cd backend && venv\Scripts\python -m app.seed
```

## Structure
- `backend/app/routers/` — bookings, approvals, dashboard, admin, teams
- `backend/app/scheduler.py` — 6 PM close-out APScheduler job
- `frontend/src/pages/` — Dashboard, MyStatus, MyHistory, Employees, Admin
- `frontend/src/api.js` — all backend calls, JWT auth interceptor

## Conventions
- Always run `pytest` after backend changes.
- Always run `npm run build` after frontend changes to catch import/JSX errors.
- Backend errors return `{"detail": "..."}` — the frontend's axios interceptor (`src/api.js`)
  unwraps this into `error.message` for toasts; keep new endpoints consistent with that shape.
