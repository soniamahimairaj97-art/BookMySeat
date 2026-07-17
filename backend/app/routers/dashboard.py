import calendar as cal
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.auth import current_user, require_role
from app.database import get_db
from app.models import DailyBooking, Employee, Holiday, Team
from app.routers.capacity import capacity_for
from app.schemas import (
    DashboardDay,
    DashboardMeOut,
    DashboardTeamOut,
    MyPeriodTotals,
    TeamPeriodTotals,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _week_range(d: date) -> tuple[date, date]:
    monday = d - timedelta(days=d.weekday())
    return monday, monday + timedelta(days=4)


def _month_range(d: date) -> tuple[date, date]:
    start = d.replace(day=1)
    last_day = cal.monthrange(d.year, d.month)[1]
    return start, d.replace(day=last_day)


def _date_range(view: str, anchor: date) -> tuple[date, date]:
    if view == "monthly":
        return _month_range(anchor)
    return _week_range(anchor)


def _holiday_map(db: Session, start: date, end: date) -> dict[date, str]:
    return {
        h.holiday_date: h.name
        for h in db.query(Holiday).filter(Holiday.holiday_date.between(start, end)).all()
    }


@router.get("/me", response_model=DashboardMeOut)
def get_my_dashboard(
    view: str = Query(default="weekly"),
    date_: date = Query(default_factory=date.today, alias="date"),
    user: Employee = Depends(current_user),
    db: Session = Depends(get_db),
):
    if view not in ("daily", "weekly", "monthly"):
        raise HTTPException(400, "view must be daily, weekly, or monthly.")
    if view == "daily":
        view = "weekly"  # Daily view is hidden for employees; falls back to weekly.

    start, end = _date_range(view, date_)
    holidays = _holiday_map(db, start, end)
    bookings = {
        b.booking_date: b.status
        for b in db.query(DailyBooking)
        .filter_by(employee_id=user.id)
        .filter(DailyBooking.booking_date.between(start, end))
        .all()
    }

    today_ = date.today()
    days: list[DashboardDay] = []
    wfo = wfh = leave = absent = working_days = 0

    d = start
    while d <= end:
        is_weekend = d.weekday() >= 5
        holiday_name = holidays.get(d)
        is_working = not is_weekend and holiday_name is None
        status = bookings.get(d)
        capacity = wfo_count = show_full = None

        if is_working:
            capacity = capacity_for(db, d)
            wfo_count = db.query(DailyBooking).filter_by(booking_date=d, status="WFO").count()
            show_full = wfo_count >= capacity
            working_days += 1
            if status == "WFO":
                wfo += 1
            elif status == "WFH":
                wfh += 1
            elif status == "L":
                leave += 1
            else:
                absent += 1

        days.append(
            DashboardDay(
                date=d,
                is_weekend=is_weekend,
                is_holiday=holiday_name is not None,
                holiday_name=holiday_name,
                is_working_day=is_working,
                is_past=d < today_,
                status=status,
                capacity=capacity,
                wfo_count=wfo_count,
                show_full=show_full,
            )
        )
        d += timedelta(days=1)

    totals = MyPeriodTotals(wfo=wfo, wfh=wfh, leave=leave, absent=absent, working_days=working_days)
    return DashboardMeOut(view=view, start=start, end=end, totals=totals, days=days)


@router.get("/team", response_model=DashboardTeamOut)
def get_team_dashboard(
    view: str = Query(default="daily"),
    date_: date = Query(default_factory=date.today, alias="date"),
    _user: Employee = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    if view not in ("daily", "weekly", "monthly"):
        raise HTTPException(400, "view must be daily, weekly, or monthly.")

    if view == "daily":
        start = end = date_
    else:
        start, end = _date_range(view, date_)

    teams = db.query(Team).filter_by(is_active=True).all()
    headcount_by_team = dict(
        db.query(Employee.team_id, func.count())
        .filter(Employee.is_active)
        .group_by(Employee.team_id)
        .all()
    )
    holidays = _holiday_map(db, start, end)

    working_days = [
        start + timedelta(n)
        for n in range((end - start).days + 1)
        if (start + timedelta(n)).weekday() < 5 and (start + timedelta(n)) not in holidays
    ]
    working_day_set = set(working_days)

    rows = (
        db.query(Employee.team_id, DailyBooking.booking_date, DailyBooking.status, func.count())
        .join(
            DailyBooking,
            and_(
                DailyBooking.employee_id == Employee.id,
                DailyBooking.booking_date.between(start, end),
            ),
        )
        .filter(Employee.is_active)
        .group_by(Employee.team_id, DailyBooking.booking_date, DailyBooking.status)
        .all()
    )

    status_key = {"WFO": "wfo", "WFH": "wfh", "L": "leave"}
    counts_by_team: dict[int, dict[str, int]] = {t.id: {"wfo": 0, "wfh": 0, "leave": 0} for t in teams}
    wfo_by_day: dict[date, int] = {d: 0 for d in working_days}

    for team_id, d, status, count in rows:
        if d not in working_day_set:
            continue  # weekend/holiday booking (e.g. a holiday declared after booking) excluded
        if team_id in counts_by_team and status in status_key:
            counts_by_team[team_id][status_key[status]] += count
        if status == "WFO":
            wfo_by_day[d] += count

    team_splits: list[TeamPeriodTotals] = []
    for t in teams:
        headcount = headcount_by_team.get(t.id, 0)
        c = counts_by_team[t.id]
        marked = c["wfo"] + c["wfh"] + c["leave"]
        possible = headcount * len(working_days)
        team_splits.append(
            TeamPeriodTotals(
                name=t.label,
                headcount=headcount,
                wfo=c["wfo"],
                wfh=c["wfh"],
                leave=c["leave"],
                absent=possible - marked,
            )
        )

    totals = TeamPeriodTotals(
        name="Total",
        headcount=sum(s.headcount for s in team_splits),
        wfo=sum(s.wfo for s in team_splits),
        wfh=sum(s.wfh for s in team_splits),
        leave=sum(s.leave for s in team_splits),
        absent=sum(s.absent for s in team_splits),
    )

    capacity = show_full = avg_wfo_utilization = None
    days: list[DashboardDay] = []

    if view == "daily":
        capacity = capacity_for(db, date_)
        show_full = totals.wfo >= capacity
    else:
        utilizations = []
        for d in working_days:
            day_capacity = capacity_for(db, d)
            if day_capacity:
                utilizations.append(wfo_by_day[d] / day_capacity)
        avg_wfo_utilization = sum(utilizations) / len(utilizations) if utilizations else 0.0

        today_ = date.today()
        d = start
        while d <= end:
            is_weekend = d.weekday() >= 5
            holiday_name = holidays.get(d)
            is_working = d in working_day_set
            day_capacity = day_wfo = day_show_full = None
            if is_working:
                day_capacity = capacity_for(db, d)
                day_wfo = wfo_by_day[d]
                day_show_full = day_wfo >= day_capacity
            days.append(
                DashboardDay(
                    date=d,
                    is_weekend=is_weekend,
                    is_holiday=holiday_name is not None,
                    holiday_name=holiday_name,
                    is_working_day=is_working,
                    is_past=d < today_,
                    capacity=day_capacity,
                    wfo_count=day_wfo,
                    show_full=day_show_full,
                )
            )
            d += timedelta(days=1)

    return DashboardTeamOut(
        view=view,
        start=start,
        end=end,
        teams=team_splits,
        totals=totals,
        working_days=len(working_days),
        capacity=capacity,
        show_full=show_full,
        avg_wfo_utilization=avg_wfo_utilization,
        days=days,
    )
