from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserRegister, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    user = models.User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        birthday=payload.birthday,
        sex=payload.sex,
        role=payload.role,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        phone_number=payload.phone_number,
        address=payload.address,
        university=payload.university,
        schedule_note=payload.schedule_note,
        calendar_link=payload.calendar_link,
        profile_photo_url=payload.profile_photo_url,
    )
    db.add(user)
    db.flush()  # get user.id before creating the driver profile

    if payload.role in (models.UserRole.driver, models.UserRole.both):
        db.add(
            models.DriverProfile(
                user_id=user.id,
                payment_methods=payload.payment_methods or [],
                payment_method_other=payload.payment_method_other,
                bio=payload.bio,
            )
        )

    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return schemas.Token(access_token=token, user=user)


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token(user.id)
    return schemas.Token(access_token=token, user=user)


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user
