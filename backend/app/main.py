from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import applications, annotations, scout, research, match

app = FastAPI(title="JobAgent API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(applications.router)
app.include_router(annotations.router)
app.include_router(scout.router)
app.include_router(research.router)
app.include_router(match.router)

@app.get("/")
def root():
    return {"status": "JobAgent API läuft"}
