import secrets
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, get_optional_user
from app.db.session import get_db
from app.models.conversion_job import ConversionJob
from app.models.plan import Plan
from app.models.user import User
from app.schemas.conversion import ConversionJobOut
from app.services import storage
from app.services.account import get_user_plan
from app.services.conversion import is_scanned_pdf_bytes
from app.workers.queue import conversion_queue
from app.workers.tasks import process_conversion_job

router = APIRouter(prefix="/conversions", tags=["conversions"])

ALLOWED_DIRECTIONS = {"pdf2word", "word2pdf"}
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25MB
OCR_MIN_TIER = 1
ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365


def _get_or_set_anon_token(request: Request, response: Response) -> str:
    token = request.cookies.get(settings.anon_cookie_name)
    if not token:
        token = secrets.token_urlsafe(32)
        response.set_cookie(
            key=settings.anon_cookie_name,
            value=token,
            httponly=True,
            secure=settings.environment != "development",
            samesite="lax",
            max_age=ANON_COOKIE_MAX_AGE,
            path="/",
        )
    return token


@router.post("", response_model=ConversionJobOut, status_code=status.HTTP_201_CREATED)
async def create_conversion(
    request: Request,
    response: Response,
    direction: str = Form(...),
    file: UploadFile = File(...),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    if direction not in ALLOWED_DIRECTIONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Dirección de conversión inválida")

    ext = Path(file.filename or "").suffix.lower()
    if direction == "pdf2word" and ext != ".pdf":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Se esperaba un archivo .pdf")
    if direction == "word2pdf" and ext not in (".doc", ".docx"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Se esperaba un archivo .doc o .docx")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "El archivo supera los 25MB")

    anon_token: str | None = None

    if user is not None:
        plan = get_user_plan(db, user)
    else:
        # Anonymous visitors get exactly one free conversion (tracked by an opaque
        # cookie, not by account), then have to register to keep converting or to
        # download anything at all.
        anon_token = _get_or_set_anon_token(request, response)
        already_used = db.query(ConversionJob).filter(ConversionJob.anon_token == anon_token).count()
        if already_used >= 1:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                "Ya usaste tu conversión gratis sin cuenta. Regístrate gratis para seguir convirtiendo.",
            )
        plan = db.query(Plan).filter(Plan.code == "free").first()

    if direction == "pdf2word" and plan.tier_level < OCR_MIN_TIER and is_scanned_pdf_bytes(content):
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            "Este PDF está escaneado y necesita OCR para convertirse. "
            "Actualiza al plan Básico o superior para usar esta función.",
        )

    if user is not None and plan.monthly_conversion_limit is not None:
        month_start = datetime.now(timezone.utc).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        used_this_month = (
            db.query(ConversionJob)
            .filter(ConversionJob.user_id == user.id, ConversionJob.created_at >= month_start)
            .count()
        )
        if used_this_month >= plan.monthly_conversion_limit:
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                f"Alcanzaste el límite de {plan.monthly_conversion_limit} conversiones "
                "este mes en el plan Free. Actualiza tu plan para seguir convirtiendo.",
            )

    job = ConversionJob(
        user_id=user.id if user else None,
        anon_token=anon_token,
        direction=direction,
        status="queued",
        original_filename=file.filename or "documento",
        input_path="",
    )
    db.add(job)
    db.flush()

    input_path = storage.save_upload(job.id, file.filename or "input", content)
    job.input_path = input_path
    db.commit()
    db.refresh(job)

    conversion_queue.enqueue(process_conversion_job, job.id, job_timeout=600)

    return job


@router.get("", response_model=list[ConversionJobOut])
def list_conversions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(ConversionJob)
        .filter(ConversionJob.user_id == user.id)
        .order_by(ConversionJob.created_at.desc())
        .all()
    )


def _owns_job(job: ConversionJob, user: User | None, anon_token: str | None) -> bool:
    if user is not None:
        return job.user_id == user.id
    return job.user_id is None and anon_token is not None and job.anon_token == anon_token


@router.get("/{job_id}", response_model=ConversionJobOut)
def get_conversion(
    job_id: int,
    request: Request,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    job = db.get(ConversionJob, job_id)
    anon_token = request.cookies.get(settings.anon_cookie_name)
    if job is None or not _owns_job(job, user, anon_token):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversión no encontrada")
    return job


@router.get("/{job_id}/download")
def download_conversion(job_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = db.get(ConversionJob, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversión no encontrada")

    if job.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversión no encontrada")

    if job.status != "done" or not storage.file_exists(job.output_path):
        raise HTTPException(
            status.HTTP_410_GONE, "El archivo no está disponible (aún no está listo o ya expiró)"
        )

    return FileResponse(job.output_path, filename=_download_filename(job))


def _download_filename(job: ConversionJob) -> str:
    stem = Path(job.original_filename).stem
    new_ext = ".docx" if job.direction == "pdf2word" else ".pdf"
    return f"{stem}{new_ext}"
