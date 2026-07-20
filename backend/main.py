"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from adapters.http_router import router

app = FastAPI(title="DSA Visual Debugger API", version="0.1.0")

# The Vite dev server proxies /v1 in development, but CORS is enabled for
# direct browser access too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
