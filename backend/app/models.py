from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    label = Column(String, nullable=False, unique=True)  # PFG, Gear_Box, e_Motor
    is_active = Column(Boolean, default=True, nullable=False)

    employees = relationship("Employee", back_populates="team")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    role = Column(String, nullable=False, default="employee")  # "employee" | "manager" | "admin"
    hashed_password = Column(String, nullable=False)

    team = relationship("Team", back_populates="employees")


class DailyBooking(Base):
    __tablename__ = "daily_bookings"
    __table_args__ = (UniqueConstraint("employee_id", "booking_date", name="uq_employee_date"),)

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    booking_date = Column(Date, nullable=False)
    status = Column(String, nullable=False)  # "WFO" | "WFH" | "L"
    slot_number = Column(Integer, nullable=True)  # auto 1-63, only when WFO
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by = Column(Integer, ForeignKey("employees.id"), nullable=True)

    employee = relationship("Employee", foreign_keys=[employee_id])


class EditApproval(Base):
    __tablename__ = "edit_approvals"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    booking_date = Column(Date, nullable=False)
    reason = Column(String, nullable=False)
    status = Column(String, nullable=False, default="Pending")  # Pending/Approved/Rejected/Used
    requested_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    decided_on = Column(DateTime, nullable=True)
    approved_by = Column(Integer, ForeignKey("employees.id"), nullable=True)

    employee = relationship("Employee", foreign_keys=[employee_id])


class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    holiday_date = Column(Date, nullable=False, unique=True)
    name = Column(String, nullable=False)
    created_by = Column(Integer, ForeignKey("employees.id"), nullable=True)


class FloorConfig(Base):
    """WFO seat capacity, effective from a given date onward. Current capacity for
    date d = seat_count of the latest row where effective_from <= d."""

    __tablename__ = "floor_config"

    id = Column(Integer, primary_key=True, index=True)
    seat_count = Column(Integer, nullable=False)
    effective_from = Column(Date, nullable=False, index=True)
    previous_count = Column(Integer, nullable=True)
    updated_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    updated_on = Column(DateTime, default=datetime.utcnow, nullable=False)
