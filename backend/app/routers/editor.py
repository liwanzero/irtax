import base64
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.core.plan_gate import require_tier
from app.db.session import get_db
from app.models.pdf_edit_job import PdfEditJob
from app.models.user import User
from app.schemas.editor import (
    AddTextRequest,
    FillFormRequest,
    PdfEditJobOut,
    ReorderRequest,
    RotateRequest,
    SplitRequest,
)
from app.services import pdf_editor, storage
from app.services.account import get_user_plan

router = APIRouter(prefix="/editor", tags=["editor"])

TIER_EDIT_BASIC = 2  # Pro: add text/image, rotate
TIER_EDIT_ADVANCED = 3  # Premium: merge, split, reorder, fill-form

MAX_UPLOAD_BYTES_DEFAULT = 25 * 1024 * 1024  # 25MB
MAX_UPLOAD_BYTES_PREMIUM = 100 * 1024 * 1024  # 100MB


def _max_upload_bytes(db: Session, user: User) -> int:
    plan = get_user_plan(db, user)
    return MAX_UPLOAD_BYTES_PREMIUM if plan.tier_level >= TIER_EDIT_ADVANCED else MAX_UPLOAD_BYTES_DEFAULT


def _get_owned_job(db: Session, job_id: int, user: User) -> PdfEditJob:
    job = db.get(PdfEditJob, job_id)
    if job is None or job.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trabajo de edición no encontrado")
    return job


@router.post("/jobs", response_model=PdfEditJobOut, status_code=status.HTTP_201_CREATED)
async def create_edit_job(
    file: UploadFile = File(...),
    user: User = Depends(require_tier(TIER_EDIT_BASIC)),
    db: Session = Depends(get_db),
):
    if Path(file.filename or "").suffix.lower() != ".pdf":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Se esperaba un archivo .pdf")

    content = await file.read()
    if len(content) > _max_upload_bytes(db, user):
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "El archivo es demasiado grande")

    job = PdfEditJob(user_id=user.id, status="active", original_filename=file.filename or "documento.pdf", input_path="")
    db.add(job)
    db.flush()

    job.input_path = storage.save_edit_upload(job.id, file.filename or "input.pdf", content)
    db.commit()
    db.refresh(job)
    return job


@router.get("/jobs", response_model=list[PdfEditJobOut])
def list_edit_jobs(user: User = Depends(require_tier(TIER_EDIT_BASIC)), db: Session = Depends(get_db)):
    return db.query(PdfEditJob).filter(PdfEditJob.user_id == user.id).order_by(PdfEditJob.created_at.desc()).all()


@router.get("/jobs/{job_id}/preview")
def preview_edit_job(job_id: int, user: User = Depends(require_tier(TIER_EDIT_BASIC)), db: Session = Depends(get_db)):
    job = _get_owned_job(db, job_id, user)
    pages = pdf_editor.render_preview(job.input_path)
    return {"pages": [f"data:image/png;base64,{base64.b64encode(p).decode()}" for p in pages]}


@router.post("/jobs/{job_id}/text", response_model=PdfEditJobOut)
def add_text(
    job_id: int,
    payload: AddTextRequest,
    user: User = Depends(require_tier(TIER_EDIT_BASIC)),
    db: Session = Depends(get_db),
):
    job = _get_owned_job(db, job_id, user)
    try:
        pdf_editor.add_text(job.input_path, payload.page_number, payload.x, payload.y, payload.text, payload.font_size)
    except pdf_editor.EditorError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    db.commit()
    db.refresh(job)
    return job


@router.post("/jobs/{job_id}/image", response_model=PdfEditJobOut)
async def add_image(
    job_id: int,
    page_number: int = Form(...),
    x: float = Form(...),
    y: float = Form(...),
    width: float = Form(...),
    height: float = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(require_tier(TIER_EDIT_BASIC)),
    db: Session = Depends(get_db),
):
    job = _get_owned_job(db, job_id, user)
    image_bytes = await file.read()
    try:
        pdf_editor.add_image(job.input_path, page_number, x, y, width, height, image_bytes)
    except pdf_editor.EditorError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    db.commit()
    db.refresh(job)
    return job


@router.post("/jobs/{job_id}/rotate", response_model=PdfEditJobOut)
def rotate(
    job_id: int,
    payload: RotateRequest,
    user: User = Depends(require_tier(TIER_EDIT_BASIC)),
    db: Session = Depends(get_db),
):
    job = _get_owned_job(db, job_id, user)
    try:
        pdf_editor.rotate_page(job.input_path, payload.page_number, payload.degrees)
    except pdf_editor.EditorError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    db.commit()
    db.refresh(job)
    return job


@router.post("/jobs/{job_id}/merge", response_model=PdfEditJobOut)
async def merge(
    job_id: int,
    file: UploadFile = File(...),
    user: User = Depends(require_tier(TIER_EDIT_ADVANCED)),
    db: Session = Depends(get_db),
):
    job = _get_owned_job(db, job_id, user)
    if Path(file.filename or "").suffix.lower() != ".pdf":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Se esperaba un archivo .pdf")
    other_bytes = await file.read()
    try:
        pdf_editor.merge_pdf(job.input_path, other_bytes)
    except pdf_editor.EditorError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    db.commit()
    db.refresh(job)
    return job


@router.post("/jobs/{job_id}/split")
def split(
    job_id: int,
    payload: SplitRequest,
    user: User = Depends(require_tier(TIER_EDIT_ADVANCED)),
    db: Session = Depends(get_db),
):
    job = _get_owned_job(db, job_id, user)
    try:
        data = pdf_editor.split_pages(job.input_path, payload.start_page, payload.end_page)
    except pdf_editor.EditorError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=paginas_extraidas.pdf"},
    )


@router.post("/jobs/{job_id}/reorder", response_model=PdfEditJobOut)
def reorder(
    job_id: int,
    payload: ReorderRequest,
    user: User = Depends(require_tier(TIER_EDIT_ADVANCED)),
    db: Session = Depends(get_db),
):
    job = _get_owned_job(db, job_id, user)
    try:
        pdf_editor.reorder_pages(job.input_path, payload.new_order)
    except pdf_editor.EditorError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    db.commit()
    db.refresh(job)
    return job


@router.post("/jobs/{job_id}/fill-form", response_model=PdfEditJobOut)
def fill_form(
    job_id: int,
    payload: FillFormRequest,
    user: User = Depends(require_tier(TIER_EDIT_ADVANCED)),
    db: Session = Depends(get_db),
):
    job = _get_owned_job(db, job_id, user)
    try:
        pdf_editor.fill_form_fields(job.input_path, payload.fields)
    except pdf_editor.EditorError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    db.commit()
    db.refresh(job)
    return job


@router.get("/jobs/{job_id}/download")
def download_edit_job(job_id: int, user: User = Depends(require_tier(TIER_EDIT_BASIC)), db: Session = Depends(get_db)):
    job = _get_owned_job(db, job_id, user)
    if not storage.file_exists(job.input_path):
        raise HTTPException(status.HTTP_410_GONE, "El archivo no está disponible")
    return FileResponse(job.input_path, filename=job.original_filename)
