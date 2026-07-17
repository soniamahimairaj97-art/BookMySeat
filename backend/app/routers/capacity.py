import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import current_user, require_role
from app.database import get_db
from app.models import DailyBooking, Employee, FloorConfig
from app.schemas import CapacityDateOut, CapacityOut, CapacityPreviewOut, CapacitySetIn, CapacitySetOut

router = APIRouter(prefix="/config", tags=["capacity"])
logger = logging.getLogger("bookmyseat.capacity")

MIN_CAPACITY = 10
MAX_CAPACITY = 200
DEFAULT_CAPACITY = 63


def capacity_for(db: Session, d: date) -> int:
    row = (
        db.query(FloorConfig)
        .filter(FloorConfig.effective_from <= d)
        .order_by(FloorConfig.effective_from.desc(), FloorConfig.id.desc())
        .first()
    )
    return row.seat_count if row else DEFAULT_CAPACITY


def _validate_range(seat_count: int) -> None:
    if not (MIN_CAPACITY <= seat_count <= MAX_CAPACITY):
        raise HTTPException(400, f"Seat count must be between {MIN_CAPACITY} and {MAX_CAPACITY}.")


def _reduction_plan(db: Session, effective_from: date, new_count: int) -> list[tuple[int, date]]:
    """FCFS keep (earliest created_on) for each affected date; everything past
    new_count is released. Returns [(employee_id, booking_date), ...] to release."""
    dates = (
        db.query(DailyBooking.booking_date)
        .filter(DailyBooking.booking_date >= effective_from, DailyBooking.status == "WFO")
        .distinct()
        .all()
    )
    released: list[tuple[int, date]] = []
    for (d,) in dates:
        wfo = (
            db.query(DailyBooking)
            .filter_by(booking_date=d, status="WFO")
            .order_by(DailyBooking.created_on)
            .all()
        )
        released.extend((b.employee_id, d) for b in wfo[new_count:])
    return released


def notify_released(released: list[tuple[int, date]]) -> None:
    for employee_id, d in released:
        logger.info(
            "NOTIFICATION employee %s: capacity reduced — your WFO slot for %s was released, "
            "you are marked WFH; rebook if a slot frees up.",
            employee_id,
            d,
        )


@router.get("/capacity")
def get_capacity(
    date_: date | None = Query(default=None, alias="date"),
    user: Employee = Depends(current_user),
    db: Session = Depends(get_db),
):
    if date_ is not None:
        return CapacityDateOut(seat_count=capacity_for(db, date_), effective_from=date_)

    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Only Admin or Manager can manage seat capacity.")

    today = date.today()
    history = (
        db.query(FloorConfig)
        .order_by(FloorConfig.effective_from.desc(), FloorConfig.id.desc())
        .all()
    )
    return CapacityOut(seat_count=capacity_for(db, today), effective_from=today, history=history)


@router.get(
    "/capacity/preview",
    response_model=CapacityPreviewOut,
    dependencies=[Depends(require_role("admin", "manager"))],
)
def preview_capacity(
    seat_count: int,
    effective_from: date = Query(default_factory=date.today),
    db: Session = Depends(get_db),
):
    _validate_range(seat_count)
    old = capacity_for(db, effective_from)
    released = _reduction_plan(db, effective_from, seat_count) if seat_count < old else []
    return CapacityPreviewOut(old_count=old, new_count=seat_count, released=len(released), effective_from=effective_from)


@router.put(
    "/capacity",
    response_model=CapacitySetOut,
    dependencies=[Depends(require_role("admin", "manager"))],
)
def set_capacity(
    req: CapacitySetIn,
    actor: Employee = Depends(current_user),
    db: Session = Depends(get_db),
):
    effective_from = req.effective_from or date.today()
    _validate_range(req.seat_count)
    if effective_from < date.today():
        raise HTTPException(400, "Effective date cannot be in the past.")

    old = capacity_for(db, effective_from)
    released: list[tuple[int, date]] = []

    if req.seat_count < old:
        dates = (
            db.query(DailyBooking.booking_date)
            .filter(DailyBooking.booking_date >= effective_from, DailyBooking.status == "WFO")
            .distinct()
            .all()
        )
        for (d,) in dates:
            wfo = (
                db.query(DailyBooking)
                .filter_by(booking_date=d, status="WFO")
                .order_by(DailyBooking.created_on)
                .all()
            )
            for i, b in enumerate(wfo):
                if i < req.seat_count:
                    b.slot_number = i + 1  # compact slots to 1..new_count
                else:
                    b.status, b.slot_number = "WFH", None  # overflow -> WFH
                    released.append((b.employee_id, d))

    db.add(
        FloorConfig(
            seat_count=req.seat_count,
            effective_from=effective_from,
            previous_count=old,
            updated_by=actor.id,
        )
    )
    db.commit()
    notify_released(released)

    return CapacitySetOut(old_count=old, new_count=req.seat_count, effective_from=effective_from, released=len(released))
