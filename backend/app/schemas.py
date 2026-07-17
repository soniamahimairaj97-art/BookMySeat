from datetime import date, datetime

from pydantic import BaseModel, EmailStr, ConfigDict


# ---- Auth ----

class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    employee_id: int
    name: str


# ---- Team ----

class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    is_active: bool


# ---- Employee ----

class EmployeeIn(BaseModel):
    name: str
    email: EmailStr
    team_id: int
    role: str = "employee"
    password: str


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    team_id: int
    is_active: bool
    role: str


# ---- Booking ----

class BookingIn(BaseModel):
    booking_date: date
    status: str  # "WFO" | "WFH" | "L"


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    booking_date: date
    status: str
    slot_number: int | None
    created_on: datetime
    updated_on: datetime


class BulkBookingIn(BaseModel):
    dates: list[date]
    status: str  # "WFO" | "WFH" | "L"


class SkippedDate(BaseModel):
    date: date
    reason: str


class BulkBookingOut(BaseModel):
    booked: list[BookingOut]
    skipped: list[SkippedDate]


# ---- Edit Approval ----

class ApprovalRequestIn(BaseModel):
    booking_date: date
    reason: str


class ApprovalDecisionIn(BaseModel):
    approve: bool


class ApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    booking_date: date
    reason: str
    status: str
    requested_on: datetime
    decided_on: datetime | None
    approved_by: int | None


# ---- Holiday ----

class HolidayIn(BaseModel):
    holiday_date: date
    name: str


class HolidayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    holiday_date: date
    name: str


# ---- Seat capacity ----

class CapacityHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    seat_count: int
    effective_from: date
    previous_count: int | None
    updated_by: int | None
    updated_on: datetime


class CapacityOut(BaseModel):
    seat_count: int
    effective_from: date
    history: list[CapacityHistoryItem] = []


class CapacityDateOut(BaseModel):
    seat_count: int
    effective_from: date


class CapacitySetIn(BaseModel):
    seat_count: int
    effective_from: date | None = None


class CapacitySetOut(BaseModel):
    old_count: int
    new_count: int
    effective_from: date
    released: int


class CapacityPreviewOut(BaseModel):
    old_count: int
    new_count: int
    released: int
    effective_from: date


# ---- Dashboard (role-scoped, v6) ----

class DashboardDay(BaseModel):
    date: date
    is_weekend: bool
    is_holiday: bool
    holiday_name: str | None
    is_working_day: bool
    is_past: bool
    status: str | None = None  # /me only: WFO | WFH | L | None
    capacity: int | None = None
    wfo_count: int | None = None
    show_full: bool | None = None


class MyPeriodTotals(BaseModel):
    wfo: int
    wfh: int
    leave: int
    absent: int
    working_days: int


class DashboardMeOut(BaseModel):
    view: str  # "weekly" | "monthly"
    start: date
    end: date
    totals: MyPeriodTotals
    days: list[DashboardDay]


class TeamPeriodTotals(BaseModel):
    name: str
    headcount: int
    wfo: int
    wfh: int
    leave: int
    absent: int


class DashboardTeamOut(BaseModel):
    view: str  # "daily" | "weekly" | "monthly"
    start: date
    end: date
    teams: list[TeamPeriodTotals]
    totals: TeamPeriodTotals
    working_days: int
    capacity: int | None = None  # daily only
    show_full: bool | None = None  # daily only
    avg_wfo_utilization: float | None = None  # weekly/monthly only, 0..1
    days: list[DashboardDay] = []  # weekly/monthly only


# ---- Day status (consolidated view for the booking screen) ----

class DayStatusOut(BaseModel):
    booking_date: date
    is_weekend: bool
    holiday_name: str | None
    is_past: bool
    wfo_count: int
    capacity: int
    show_full: bool
    my_status: str | None
    my_slot: int | None
    my_approval_status: str | None  # None | "Pending" | "Approved" | "Rejected" | "Used"
