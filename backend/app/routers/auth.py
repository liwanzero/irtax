from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.oauth import oauth
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, UserOut
from app.services.account import get_user_plan, provision_new_user, user_plan_and_status

router = APIRouter(prefix="/auth", tags=["auth"])


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


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese correo ya está registrado")

    user = provision_new_user(db, email=payload.email, password_hash=hash_password(payload.password))
    _set_session_cookie(response, user.id)
    return _user_out(db, user)


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or user.password_hash is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Correo o contraseña incorrectos")

    _set_session_cookie(response, user.id)
    return _user_out(db, user)


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

    response = RedirectResponse(url=f"{settings.frontend_url}/dashboard")
    _set_session_cookie(response, user.id)
    return response
