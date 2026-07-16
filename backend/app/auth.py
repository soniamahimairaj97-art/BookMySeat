import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Employee
from app.schemas import LoginIn, TokenOut

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

router = APIRouter(tags=["auth"])


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(employee: Employee) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(employee.id), "role": employee.role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/login", response_model=TokenOut)
def login(req: LoginIn, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter_by(email=req.email, is_active=True).first()
    if not employee or not verify_password(req.password, employee.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password.")
    token = create_access_token(employee)
    return TokenOut(
        access_token=token,
        role=employee.role,
        employee_id=employee.id,
        name=employee.name,
    )


def current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Employee:
    credentials_error = HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials.")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        employee_id = payload.get("sub")
        if employee_id is None:
            raise credentials_error
    except JWTError:
        raise credentials_error

    employee = db.query(Employee).filter_by(id=int(employee_id), is_active=True).first()
    if employee is None:
        raise credentials_error
    return employee


def require_role(role: str):
    def dependency(user: Employee = Depends(current_user)) -> Employee:
        if user.role != role:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Requires {role} role.")
        return user

    return dependency
