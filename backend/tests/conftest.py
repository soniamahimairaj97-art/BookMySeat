from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import hash_password
from app.database import Base, get_db
from app.main import app
from app.models import Employee, Team

DEFAULT_PASSWORD = "pass1234"

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    yield session
    session.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def team(db):
    t = Team(label="PFG", is_active=True)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def make_employee(db, team, name, email, role="employee", password=DEFAULT_PASSWORD):
    e = Employee(
        name=name,
        email=email,
        team_id=team.id,
        role=role,
        hashed_password=hash_password(password),
        is_active=True,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


@pytest.fixture
def employee(db, team):
    return make_employee(db, team, "Alice", "alice@test.example.com")


@pytest.fixture
def manager(db, team):
    return make_employee(db, team, "Manager", "mgr@test.example.com", role="manager")


@pytest.fixture
def admin(db, team):
    return make_employee(db, team, "Admin", "admin@test.example.com", role="admin")


def login(client, email, password=DEFAULT_PASSWORD):
    resp = client.post("/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def next_bookable_weekday(days_ahead_start=1):
    d = date.today() + timedelta(days=days_ahead_start)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d
