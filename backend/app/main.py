from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import settings
from app.routers import auth, billing, conversions, editor, webhooks

_docs_enabled = settings.environment != "production"
app = FastAPI(
    title="irtax API",
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(conversions.router)
app.include_router(billing.router)
app.include_router(webhooks.router)
app.include_router(editor.router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "google_enabled": settings.google_enabled,
        "stripe_enabled": settings.stripe_enabled,
    }
