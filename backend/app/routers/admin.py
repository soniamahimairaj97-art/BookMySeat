import calendar
from datetime import date, timedelta
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy.orm import Session

from app.auth import current_user, hash_password, require_role
from app.database import get_db
from app.models import DailyBooking, Employee, Holiday, Team
from app.schemas import EmployeeIn, EmployeeOut, HolidayIn, HolidayOut

router = APIRouter(tags=["admin"])


@router.get("/employees", response_model=list[EmployeeOut])
def list_employees(
    _user: Employee = Depends(current_user),
    db: Session = Depends(get_db),
):
    return db.query(Employee).order_by(Employee.team_id, Employee.name).all()


@router.get("/holidays", response_model=list[HolidayOut])
def list_holidays(
    _user: Employee = Depends(current_user),
    db: Session = Depends(get_db),
):
    return db.query(Holiday).order_by(Holiday.holiday_date).all()


@router.post("/employees", response_model=EmployeeOut)
def add_employee(
    req: EmployeeIn,
    _manager: Employee = Depends(require_role("manager")),
    db: Session = Depends(get_db),
):
    if not db.query(Team).filter_by(id=req.team_id, is_active=True).first():
        raise HTTPException(400, "Unknown or inactive team.")
    if db.query(Employee).filter_by(email=req.email).first():
        raise HTTPException(409, "An employee with this email already exists.")

    employee = Employee(
        name=req.name,
        email=req.email,
        team_id=req.team_id,
        role=req.role,
        hashed_password=hash_password(req.password),
        is_active=True,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@router.post("/holidays", response_model=HolidayOut)
def add_holiday(
    req: HolidayIn,
    manager: Employee = Depends(require_role("manager")),
    db: Session = Depends(get_db),
):
    if db.query(Holiday).filter_by(holiday_date=req.holiday_date).first():
        raise HTTPException(409, "A holiday is already set for this date.")

    holiday = Holiday(holiday_date=req.holiday_date, name=req.name, created_by=manager.id)
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    return holiday


@router.delete("/holidays/{holiday_date}")
def delete_holiday(
    holiday_date: date,
    _manager: Employee = Depends(require_role("manager")),
    db: Session = Depends(get_db),
):
    holiday = db.query(Holiday).filter_by(holiday_date=holiday_date).first()
    if not holiday:
        raise HTTPException(404, "No holiday set for this date.")
    db.delete(holiday)
    db.commit()
    return {"deleted": True}


@router.get("/export")
def export_excel(
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    _manager: Employee = Depends(require_role("manager")),
    db: Session = Depends(get_db),
):
    today = date.today()
    if start is None:
        start = today.replace(day=1)
    if end is None:
        last_day = calendar.monthrange(today.year, today.month)[1]
        end = today.replace(day=last_day)
    if end < start:
        raise HTTPException(400, "end date must not be before start date.")

    days = [start + timedelta(n) for n in range((end - start).days + 1)]

    employees = db.query(Employee).filter_by(is_active=True).order_by(Employee.team_id, Employee.name).all()
    bookings = db.query(DailyBooking).filter(
        DailyBooking.booking_date >= start, DailyBooking.booking_date <= end
    ).all()
    booking_map = {(b.employee_id, b.booking_date): b.status for b in bookings}
    teams = {t.id: t.label for t in db.query(Team).all()}

    wb = Workbook()
    ws = wb.active
    ws.title = "Attendance"
    ws.append(["Employee", "Team"] + [d.isoformat() for d in days])

    team_totals: dict[str, dict[str, int]] = {}
    for emp in employees:
        row = [emp.name, teams.get(emp.team_id, "")]
        team_label = teams.get(emp.team_id, "")
        team_totals.setdefault(team_label, {"WFO": 0, "WFH": 0, "L": 0, "A": 0})
        for d in days:
            if d.weekday() >= 5:
                row.append("")
                continue
            status = booking_map.get((emp.id, d), "A")
            row.append(status)
            team_totals[team_label][status] = team_totals[team_label].get(status, 0) + 1
        ws.append(row)

    totals_ws = wb.create_sheet("Team Totals")
    totals_ws.append(["Team", "WFO", "WFH", "L", "A"])
    for team_label, counts in team_totals.items():
        totals_ws.append([team_label, counts["WFO"], counts["WFH"], counts["L"], counts["A"]])

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    filename = f"attendance_{start.isoformat()}_{end.isoformat()}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
