from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import current_user, require_role
from app.database import get_db
from app.models import EditApproval, Employee
from app.schemas import ApprovalDecisionIn, ApprovalOut, ApprovalRequestIn

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.post("", response_model=ApprovalOut)
def request_edit(
    req: ApprovalRequestIn,
    user: Employee = Depends(current_user),
    db: Session = Depends(get_db),
):
    duplicate = (
        db.query(EditApproval)
        .filter_by(employee_id=user.id, booking_date=req.booking_date, status="Pending")
        .first()
    )
    if duplicate:
        raise HTTPException(409, "An edit request for this date is already pending.")

    approval = EditApproval(
        employee_id=user.id,
        booking_date=req.booking_date,
        reason=req.reason,
        status="Pending",
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)
    return approval


@router.get("/mine", response_model=list[ApprovalOut])
def my_approvals(
    user: Employee = Depends(current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(EditApproval)
        .filter_by(employee_id=user.id)
        .order_by(EditApproval.requested_on.desc())
        .all()
    )


@router.get("/pending", response_model=list[ApprovalOut])
def list_pending(
    manager: Employee = Depends(require_role("manager")),
    db: Session = Depends(get_db),
):
    return db.query(EditApproval).filter_by(status="Pending").all()


@router.put("/{approval_id}", response_model=ApprovalOut)
def decide(
    approval_id: int,
    req: ApprovalDecisionIn,
    manager: Employee = Depends(require_role("manager")),
    db: Session = Depends(get_db),
):
    approval = db.query(EditApproval).filter_by(id=approval_id).first()
    if not approval:
        raise HTTPException(404, "Approval request not found.")
    if approval.status != "Pending":
        raise HTTPException(409, f"Request already {approval.status}.")

    approval.status = "Approved" if req.approve else "Rejected"
    approval.decided_on = datetime.utcnow()
    approval.approved_by = manager.id
    db.commit()
    db.refresh(approval)
    return approval
