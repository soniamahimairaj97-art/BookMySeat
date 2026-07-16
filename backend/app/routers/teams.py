from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import current_user
from app.database import get_db
from app.models import Employee, Team
from app.schemas import TeamOut

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("", response_model=list[TeamOut])
def list_teams(
    _user: Employee = Depends(current_user),
    db: Session = Depends(get_db),
):
    return db.query(Team).filter_by(is_active=True).order_by(Team.label).all()
