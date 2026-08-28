from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine
from .routers import auth, availability, balances, geocode, messages, reviews, rides, users

settings = get_settings()

app = FastAPI(title="CarpoolCampus API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # For this MVP we create tables directly from the models if they don't
    # exist yet. Real schema changes should go through Alembic migrations
    # (see backend/alembic) once this app moves past local demo use.
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(availability.router)
app.include_router(rides.router)
app.include_router(messages.router)
app.include_router(reviews.router)
app.include_router(users.router)
app.include_router(geocode.router)
app.include_router(balances.router)
