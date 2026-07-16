import logging
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database import SessionLocal
from app.models import DailyBooking, Employee, Team

logger = logging.getLogger("bookmyseat.scheduler")

scheduler = BackgroundScheduler()


def close_out_day() -> None:
    """Runs at 18:00 on business days: the day becomes 'closed' (bookings.py
    already enforces this via the EditApproval requirement for past dates),
    and a split-summary is logged / sent as a notification."""
    today = date.today()
    if today.weekday() >= 5:
        return

    db = SessionLocal()
    try:
        teams = db.query(Team).filter_by(is_active=True).all()
        lines = [f"Day close-out summary for {today.isoformat()}:"]
        for team in teams:
            headcount = db.query(Employee).filter_by(team_id=team.id, is_active=True).count()
            wfo = (
                db.query(DailyBooking)
                .filter_by(booking_date=today, status="WFO")
                .join(Employee)
                .filter(Employee.team_id == team.id)
                .count()
            )
            wfh = (
                db.query(DailyBooking)
                .filter_by(booking_date=today, status="WFH")
                .join(Employee)
                .filter(Employee.team_id == team.id)
                .count()
            )
            leave = (
                db.query(DailyBooking)
                .filter_by(booking_date=today, status="L")
                .join(Employee)
                .filter(Employee.team_id == team.id)
                .count()
            )
            absent = headcount - (wfo + wfh + leave)
            lines.append(
                f"  {team.label}: headcount={headcount} WFO={wfo} WFH={wfh} L={leave} A={absent}"
            )
        message = "\n".join(lines)
        logger.info(message)
        send_notification(message)
    finally:
        db.close()


def send_notification(message: str) -> None:
    """Placeholder for email / Teams webhook delivery. Wire an SMTP client or
    requests.post(TEAMS_WEBHOOK_URL, json={"text": message}) here."""
    logger.info("NOTIFICATION:\n%s", message)


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.add_job(close_out_day, CronTrigger(hour=18, minute=0), id="day_close_out")
        scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
