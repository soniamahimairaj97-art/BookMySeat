from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import current_user
from app.database import get_db
from app.models import DailyBooking, Employee, EditApproval, Holiday
from app.routers.capacity import capacity_for
from app.schemas import BookingIn, BookingOut, BulkBookingIn, BulkBookingOut, DayStatusOut, SkippedDate

router = APIRouter(prefix="/bookings", tags=["bookings"])


def next_free_slot(db: Session, d: date, capacity: int) -> int:
    taken = {
        row[0]
        for row in db.query(DailyBooking.slot_number)
        .filter_by(booking_date=d, status="WFO")
        .filter(DailyBooking.slot_number.isnot(None))
        .all()
    }
    for slot in range(1, capacity + 1):
        if slot not in taken:
            return slot
    raise HTTPException(409, f"Show Full — all {capacity} WFO slots are booked.")


def upsert_booking(db: Session, employee_id: int, d: date, status: str, slot: int | None) -> DailyBooking:
    existing = db.query(DailyBooking).filter_by(employee_id=employee_id, booking_date=d).first()
    if existing:
        existing.status = status
        existing.slot_number = slot
        existing.updated_by = employee_id
        booking = existing
    else:
        booking = DailyBooking(
            employee_id=employee_id,
            booking_date=d,
            status=status,
            slot_number=slot,
            updated_by=employee_id,
        )
        db.add(booking)
    return booking


@router.post("", response_model=BookingOut)
def book(req: BookingIn, user: Employee = Depends(current_user), db: Session = Depends(get_db)):
    d = req.booking_date

    if req.status not in ("WFO", "WFH", "L"):
        raise HTTPException(400, "status must be one of WFO, WFH, L.")

    if d.weekday() >= 5:
        raise HTTPException(400, "Weekends are not bookable.")
    if db.query(Holiday).filter_by(holiday_date=d).first():
        raise HTTPException(400, "This date is shut down by the manager.")
    if d > date.today() + timedelta(days=7):
        raise HTTPException(400, "Booking window is 7 days.")

    existing = db.query(DailyBooking).filter_by(employee_id=user.id, booking_date=d).first()

    # Closed-day rule: past dates need an Approved EditApproval
    if d < date.today():
        approval = (
            db.query(EditApproval)
            .filter_by(employee_id=user.id, booking_date=d, status="Approved")
            .first()
        )
        if not approval:
            raise HTTPException(403, "Day closed. Request manager approval to edit.")
        approval.status = "Used"  # one-time edit

    if existing and existing.status == req.status:
        raise HTTPException(409, f"Already marked {req.status} — slot is filled for this date.")

    if req.status == "WFO":
        capacity = capacity_for(db, d)
        # Show Full — count inside a transaction (row lock in Postgres) to stop the (capacity+1)th booking
        wfo = (
            db.query(DailyBooking)
            .filter_by(booking_date=d, status="WFO")
            .with_for_update()
            .count()
        )
        if wfo >= capacity and (not existing or existing.status != "WFO"):
            raise HTTPException(409, f"Show Full — all {capacity} WFO slots are booked.")
        slot = next_free_slot(db, d, capacity)  # auto-assign; user never picks
    else:
        slot = None  # WFH / Leave need no slot

    booking = upsert_booking(db, user.id, d, req.status, slot)  # change WFO->WFH frees the slot
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/me", response_model=list[BookingOut])
def my_bookings(user: Employee = Depends(current_user), db: Session = Depends(get_db)):
    return (
        db.query(DailyBooking)
        .filter_by(employee_id=user.id)
        .order_by(DailyBooking.booking_date.desc())
        .all()
    )


@router.get("/status", response_model=DayStatusOut)
def day_status(
    booking_date: date = Query(alias="date"),
    user: Employee = Depends(current_user),
    db: Session = Depends(get_db),
):
    holiday = db.query(Holiday).filter_by(holiday_date=booking_date).first()
    wfo_count = db.query(DailyBooking).filter_by(booking_date=booking_date, status="WFO").count()
    mine = db.query(DailyBooking).filter_by(employee_id=user.id, booking_date=booking_date).first()
    capacity = capacity_for(db, booking_date)

    approval = None
    if booking_date < date.today():
        approval = (
            db.query(EditApproval)
            .filter_by(employee_id=user.id, booking_date=booking_date)
            .order_by(EditApproval.requested_on.desc())
            .first()
        )

    return DayStatusOut(
        booking_date=booking_date,
        is_weekend=booking_date.weekday() >= 5,
        holiday_name=holiday.name if holiday else None,
        is_past=booking_date < date.today(),
        wfo_count=wfo_count,
        capacity=capacity,
        show_full=wfo_count >= capacity,
        my_status=mine.status if mine else None,
        my_slot=mine.slot_number if mine else None,
        my_approval_status=approval.status if approval else None,
    )
