"""Pydantic request/response models."""
from datetime import datetime, date, time
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, ConfigDict

from .models import UserRole, RideStatus, PickupType


# ---------- Auth / Users ----------

class UserRegister(BaseModel):
    first_name: str
    last_name: str
    birthday: Optional[date] = None
    sex: Optional[str] = None
    role: UserRole = UserRole.rider
    email: EmailStr
    password: str = Field(min_length=6)
    phone_number: Optional[str] = None
    address: Optional[str] = None
    schedule_note: Optional[str] = None
    # Driver-only, ignored for pure riders
    payment_methods: Optional[list[str]] = None
    payment_method_other: Optional[str] = None
    bio: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class DriverProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    payment_methods: list[str] = []
    payment_method_other: Optional[str] = None
    bio: Optional[str] = None
    avg_rating: float = 0


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    first_name: str
    last_name: str
    birthday: Optional[date] = None
    sex: Optional[str] = None
    role: UserRole
    email: EmailStr
    phone_number: Optional[str] = None
    address: Optional[str] = None
    schedule_note: Optional[str] = None
    created_at: datetime
    driver_profile: Optional[DriverProfileOut] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Availability ----------

class AvailabilityCreate(BaseModel):
    day_of_week: Optional[int] = Field(default=None, ge=0, le=6)
    date: Optional[date] = None
    start_time: time
    end_time: time
    route_from: str
    route_to: str
    seats_available: int = Field(default=1, ge=1, le=8)


class AvailabilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    driver_id: int
    day_of_week: Optional[int] = None
    date: Optional[date] = None
    start_time: time
    end_time: time
    route_from: str
    route_to: str
    seats_available: int
    driver: Optional[UserOut] = None


# ---------- Ride requests ----------

class RideRequestCreate(BaseModel):
    driver_id: int
    availability_id: Optional[int] = None
    pickup_type: PickupType
    custom_time: Optional[datetime] = None
    custom_place: Optional[str] = None
    suggested_payment_amount: Optional[float] = None
    payment_method_chosen: Optional[str] = None


class RideRequestUpdate(BaseModel):
    status: Optional[RideStatus] = None
    custom_time: Optional[datetime] = None
    custom_place: Optional[str] = None
    suggested_payment_amount: Optional[float] = None
    payment_method_chosen: Optional[str] = None


class RideRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    rider_id: int
    driver_id: int
    availability_id: Optional[int] = None
    status: RideStatus
    pickup_type: PickupType
    custom_time: Optional[datetime] = None
    custom_place: Optional[str] = None
    suggested_payment_amount: Optional[float] = None
    payment_method_chosen: Optional[str] = None
    created_at: datetime
    rider: Optional[UserOut] = None
    driver: Optional[UserOut] = None
    availability: Optional[AvailabilityOut] = None


# ---------- Messages ----------

class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ride_request_id: int
    sender_id: int
    content: str
    sent_at: datetime
    sender: Optional[UserOut] = None


# ---------- Reviews ----------

class ReviewCreate(BaseModel):
    ride_request_id: int
    reviewee_id: int
    stars_driving_style: Optional[int] = Field(default=None, ge=1, le=5)
    stars_speed: Optional[int] = Field(default=None, ge=1, le=5)
    stars_cleanliness: Optional[int] = Field(default=None, ge=1, le=5)
    stars_punctuality: Optional[int] = Field(default=None, ge=1, le=5)
    free_text_feedback: Optional[str] = None
    audio_url: Optional[str] = None
    paid: bool = False
    paid_method: Optional[str] = None


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ride_request_id: int
    reviewer_id: int
    reviewee_id: int
    stars_driving_style: Optional[int] = None
    stars_speed: Optional[int] = None
    stars_cleanliness: Optional[int] = None
    stars_punctuality: Optional[int] = None
    free_text_feedback: Optional[str] = None
    audio_url: Optional[str] = None
    paid: bool
    paid_method: Optional[str] = None
    created_at: datetime
    reviewer: Optional[UserOut] = None
