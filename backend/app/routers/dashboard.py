from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.auth import current_user
from app.database import get_db
from app.models import DailyBooking, Employee, Team
from app.routers.bookings import CAPACITY
from app.schemas import DashboardOut, TeamSplit

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOut)
def get_dashboard(
    date_: date = Query(default_factory=date.today, alias="date"),
    _user: Employee = Depends(current_user),
    db: Session = Depends(get_db),
):
    teams = db.query(Team).filter_by(is_active=True).all()

    rows = (
        db.query(Employee.team_id, DailyBooking.status, func.count())
        .outerjoin(
            DailyBooking,
            and_(
                DailyBooking.employee_id == Employee.id,
                DailyBooking.booking_date == date_,
            ),
        )
        .filter(Employee.is_active)
        .group_by(Employee.team_id, DailyBooking.status)
        .all()
    )

    headcount_rows = (
        db.query(Employee.team_id, func.count())
        .filter(Employee.is_active)
        .group_by(Employee.team_id)
        .all()
    )
    headcount_by_team = dict(headcount_rows)

    counts_by_team: dict[int, dict[str, int]] = {
        t.id: {"wfo": 0, "wfh": 0, "leave": 0} for t in teams
    }
    status_key = {"WFO": "wfo", "WFH": "wfh", "L": "leave"}
    for team_id, status, count in rows:
        if team_id in counts_by_team and status in status_key:
            counts_by_team[team_id][status_key[status]] = count

    team_splits: list[TeamSplit] = []
    for t in teams:
        headcount = headcount_by_team.get(t.id, 0)
        c = counts_by_team[t.id]
        marked = c["wfo"] + c["wfh"] + c["leave"]
        team_splits.append(
            TeamSplit(
                name=t.label,
                headcount=headcount,
                wfo=c["wfo"],
                wfh=c["wfh"],
                leave=c["leave"],
                absent=headcount - marked,
            )
        )

    totals = TeamSplit(
        name="Total",
        headcount=sum(s.headcount for s in team_splits),
        wfo=sum(s.wfo for s in team_splits),
        wfh=sum(s.wfh for s in team_splits),
        leave=sum(s.leave for s in team_splits),
        absent=sum(s.absent for s in team_splits),
    )

    return DashboardOut(
        teams=team_splits,
        totals=totals,
        capacity=CAPACITY,
        show_full=totals.wfo >= CAPACITY,
    )
