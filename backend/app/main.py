import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import router as auth_router
from app.database import Base, engine
from app.routers.admin import router as admin_router
from app.routers.approvals import router as approvals_router
from app.routers.bookings import router as bookings_router
from app.routers.capacity import router as capacity_router
from app.routers.dashboard import router as dashboard_router
from app.routers.teams import router as teams_router
from app.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="BookMySeat API", lifespan=lifespan)

extra_origins = [o.strip() for o in os.getenv("CORS_EXTRA_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", *extra_origins],
    # Quick Cloudflare Tunnels mint a random *.trycloudflare.com hostname per run,
    # so the frontend's public URL can't be known ahead of time.
    allow_origin_regex=r"https://.*\.trycloudflare\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(bookings_router)
app.include_router(approvals_router)
app.include_router(dashboard_router)
app.include_router(admin_router)
app.include_router(teams_router)
app.include_router(capacity_router)


@app.get("/health")
def health():
    return {"status": "ok"}
