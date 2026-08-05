import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.email import send_email
from app.core.oauth import oauth
from app.core.rate_limit import rate_limit
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.schemas.auth import ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest, UserOut
from app.services.account import (
    claim_anonymous_conversions,
    get_user_plan,
    provision_new_user,
    user_plan_and_status,
)

router = APIRouter(prefix="/auth", tags=["auth"])

RESET_TOKEN_TTL_MINUTES = 60


@router.get("/config")
def auth_config():
    return {"google_enabled": settings.google_enabled}


def _set_session_cookie(response: Response, user_id: int) -> None:
    token = create_access_token(user_id)
    response.set_cookie(
        key=settings.jwt_cookie_name,
        value=token,
        httponly=True,
        secure=settings.environment != "development",
        samesite="lax",
        max_age=settings.jwt_expire_minutes * 60,
        path="/",
    )


def _user_out(db: Session, user: User) -> UserOut:
    plan_code, status_ = user_plan_and_status(db, user)
    plan = get_user_plan(db, user)
    return UserOut(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
        plan_code=plan_code,
        tier_level=plan.tier_level,
        subscription_status=status_,
    )


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[rate_limit("register", max_requests=5, window_seconds=3600)],
)
def register(payload: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese correo ya está registrado")

    user = provision_new_user(db, email=payload.email, password_hash=hash_password(payload.password))
    claim_anonymous_conversions(db, request.cookies.get(settings.anon_cookie_name), user.id)
    _set_session_cookie(response, user.id)
    return _user_out(db, user)


@router.post(
    "/login",
    response_model=UserOut,
    dependencies=[rate_limit("login", max_requests=10, window_seconds=300)],
)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or user.password_hash is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Correo o contraseña incorrectos")

    claim_anonymous_conversions(db, request.cookies.get(settings.anon_cookie_name), user.id)
    _set_session_cookie(response, user.id)
    return _user_out(db, user)


@router.post(
    "/forgot-password",
    dependencies=[rate_limit("forgot_password", max_requests=5, window_seconds=3600)],
)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user is not None and user.password_hash is not None:
        token = secrets.token_urlsafe(32)
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token=token,
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
            )
        )
        db.commit()
        reset_url = f"{settings.frontend_url}/restablecer?token={token}"
        send_email(
            user.email,
            "Restablece tu contraseña — irtax",
            f"""
            <p>Recibimos una solicitud para restablecer tu contraseña en irtax.</p>
            <p><a href="{reset_url}">Haz clic aquí para elegir una nueva contraseña</a></p>
            <p>Este enlace expira en 1 hora. Si no fuiste tú, ignora este correo.</p>
            """,
        )
    # Always respond the same way, exista o no la cuenta, para no filtrar qué correos están registrados.
    return {"ok": True}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset = db.query(PasswordResetToken).filter(PasswordResetToken.token == payload.token).first()
    if reset is None or reset.used or reset.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El enlace no es válido o ya expiró")

    user = db.query(User).filter(User.id == reset.user_id).first()
    user.password_hash = hash_password(payload.password)
    reset.used = True
    db.commit()
    return {"ok": True}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(settings.jwt_cookie_name, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _user_out(db, user)


@router.get("/google/login")
async def google_login(request: Request):
    if not settings.google_enabled:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Google login no está configurado")
    redirect_uri = settings.google_redirect_uri
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    if not settings.google_enabled:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Google login no está configurado")

    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo")
    if userinfo is None or not userinfo.get("email"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No se pudo obtener el perfil de Google")

    email = userinfo["email"]
    google_id = userinfo["sub"]

    user = db.query(User).filter(User.google_id == google_id).first()
    if user is None:
        user = db.query(User).filter(User.email == email).first()
        if user is not None:
            user.google_id = google_id
            db.commit()
            db.refresh(user)
        else:
            user = provision_new_user(db, email=email, google_id=google_id)

    claim_anonymous_conversions(db, request.cookies.get(settings.anon_cookie_name), user.id)
    response = RedirectResponse(url=f"{settings.frontend_url}/dashboard")
    _set_session_cookie(response, user.id)
    return response
