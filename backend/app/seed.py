"""Seed script: 3 teams, 70 employees (PFG 27, Gear_Box 20, e_Motor 23), one manager.

Run with:  python -m app.seed
"""

from datetime import date

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import Employee, FloorConfig, Team

TEAM_COUNTS = {"PFG": 27, "Gear_Box": 20, "e_Motor": 23}
DEFAULT_PASSWORD = "password123"
GO_LIVE_CAPACITY = 63


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Team).first():
            print("Database already seeded — skipping.")
            return

        teams = {}
        for label in TEAM_COUNTS:
            team = Team(label=label, is_active=True)
            db.add(team)
            db.flush()
            teams[label] = team

        for label, count in TEAM_COUNTS.items():
            slug = label.lower().replace("_", "")
            for i in range(1, count + 1):
                db.add(
                    Employee(
                        name=f"{label} Employee {i}",
                        email=f"{slug}{i}@bookmyseat.example.com",
                        team_id=teams[label].id,
                        role="employee",
                        hashed_password=hash_password(DEFAULT_PASSWORD),
                        is_active=True,
                    )
                )

        db.add(
            Employee(
                name="Manager",
                email="manager@bookmyseat.example.com",
                team_id=teams["PFG"].id,
                role="manager",
                hashed_password=hash_password(DEFAULT_PASSWORD),
                is_active=True,
            )
        )
        db.add(
            Employee(
                name="Admin",
                email="admin@bookmyseat.example.com",
                team_id=teams["PFG"].id,
                role="admin",
                hashed_password=hash_password(DEFAULT_PASSWORD),
                is_active=True,
            )
        )
        db.add(
            FloorConfig(
                seat_count=GO_LIVE_CAPACITY,
                effective_from=date.today(),
                previous_count=None,
                updated_by=None,
            )
        )

        db.commit()
        total = sum(TEAM_COUNTS.values()) + 2
        print(f"Seeded {len(teams)} teams and {total} employees (default password: {DEFAULT_PASSWORD}).")
    finally:
        db.close()


if __name__ == "__main__":
    run()
