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


# ---- Dashboard ----

class TeamSplit(BaseModel):
    name: str
    headcount: int
    wfo: int
    wfh: int
    leave: int
    absent: int


class DashboardOut(BaseModel):
    teams: list[TeamSplit]
    totals: TeamSplit
    capacity: int
    show_full: bool


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
