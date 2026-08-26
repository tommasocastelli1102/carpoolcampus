"""SQLAlchemy ORM models for CarpoolCampus."""
import enum
from datetime import datetime, date, time

from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    DateTime,
    Date,
    Time,
    Boolean,
    Text,
    Numeric,
    JSON,
    Enum as SAEnum,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class UserRole(str, enum.Enum):
    driver = "driver"
    rider = "rider"
    both = "both"


class RideStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    declined = "declined"
    completed = "completed"
    cancelled = "cancelled"


class PickupType(str, enum.Enum):
    pickup = "pickup"
    meet_outside = "meet_outside"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    birthday: Mapped[date | None] = mapped_column(Date, nullable=True)
    sex: Mapped[str | None] = mapped_column(String(30), nullable=True)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="user_role"), default=UserRole.rider)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    phone_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    university: Mapped[str | None] = mapped_column(
        String(255), nullable=True, doc="e.g. 'UCLA Anderson School of Management' or 'UCLA'"
    )
    schedule_note: Mapped[str | None] = mapped_column(
        Text, nullable=True, doc="Free text: when free to drive / when rides are typically needed"
    )
    calendar_link: Mapped[str | None] = mapped_column(
        String(500), nullable=True, doc="Optional shareable calendar URL (e.g. Google Calendar)"
    )
    profile_photo_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True, doc="Optional profile photo URL; falls back to a car/backpack icon in the UI"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    driver_profile: Mapped["DriverProfile"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    availability_slots: Mapped[list["Availability"]] = relationship(
        back_populates="driver", foreign_keys="Availability.driver_id", cascade="all, delete-orphan"
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class DriverProfile(Base):
    __tablename__ = "driver_profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    payment_methods: Mapped[list] = mapped_column(JSON, default=list)
    payment_method_other: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    avg_rating: Mapped[float] = mapped_column(Numeric(3, 2), default=0)

    user: Mapped["User"] = relationship(back_populates="driver_profile")


class Availability(Base):
    __tablename__ = "availability"

    id: Mapped[int] = mapped_column(primary_key=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day_of_week: Mapped[int | None] = mapped_column(
        Integer, nullable=True, doc="0=Mon..6=Sun, for recurring slots"
    )
    date: Mapped[date | None] = mapped_column(Date, nullable=True, doc="Set for one-off slots")
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    route_from: Mapped[str] = mapped_column(String(255))
    route_to: Mapped[str] = mapped_column(String(255))
    seats_available: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    driver: Mapped["User"] = relationship(back_populates="availability_slots", foreign_keys=[driver_id])
    ride_requests: Mapped[list["RideRequest"]] = relationship(back_populates="availability")


class RideRequest(Base):
    __tablename__ = "rides_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    rider_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    availability_id: Mapped[int | None] = mapped_column(
        ForeignKey("availability.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[RideStatus] = mapped_column(SAEnum(RideStatus, name="ride_status"), default=RideStatus.pending)
    pickup_type: Mapped[PickupType] = mapped_column(SAEnum(PickupType, name="pickup_type"))
    custom_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    custom_place: Mapped[str | None] = mapped_column(String(255), nullable=True)
    suggested_payment_amount: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    payment_method_chosen: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    rider: Mapped["User"] = relationship(foreign_keys=[rider_id])
    driver: Mapped["User"] = relationship(foreign_keys=[driver_id])
    availability: Mapped["Availability | None"] = relationship(back_populates="ride_requests")
    messages: Mapped[list["Message"]] = relationship(back_populates="ride_request", cascade="all, delete-orphan")
    reviews: Mapped[list["Review"]] = relationship(back_populates="ride_request", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    ride_request_id: Mapped[int] = mapped_column(ForeignKey("rides_requests.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ride_request: Mapped["RideRequest"] = relationship(back_populates="messages")
    sender: Mapped["User"] = relationship()


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    ride_request_id: Mapped[int] = mapped_column(ForeignKey("rides_requests.id", ondelete="CASCADE"), index=True)
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    reviewee_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    stars_driving_style: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stars_speed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stars_cleanliness: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stars_punctuality: Mapped[int | None] = mapped_column(Integer, nullable=True)
    free_text_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    paid: Mapped[bool] = mapped_column(Boolean, default=False)
    paid_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ride_request: Mapped["RideRequest"] = relationship(back_populates="reviews")
    reviewer: Mapped["User"] = relationship(foreign_keys=[reviewer_id])
    reviewee: Mapped["User"] = relationship(foreign_keys=[reviewee_id])
