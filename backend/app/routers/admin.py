from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.session import get_db
from app.models.checkout_attempt import CheckoutAttempt
from app.models.conversion_job import ConversionJob
from app.models.pdf_edit_job import PdfEditJob
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.admin import AdminLookupOut, JobUsageOut, SubscriptionSummaryOut
from app.services import pdf_editor

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _lookup_data(email: str, db: Session) -> AdminLookupOut:
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No hay ningún usuario con ese correo")

    subscription = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    subscription_out = None
    if subscription is not None:
        subscription_out = SubscriptionSummaryOut(
            plan_name=subscription.plan.name,
            plan_code=subscription.plan.code,
            status=subscription.status,
            current_period_end=subscription.current_period_end,
            stripe_subscription_id=subscription.stripe_subscription_id,
        )

    checkout_attempts = (
        db.query(CheckoutAttempt)
        .filter(CheckoutAttempt.user_id == user.id)
        .order_by(CheckoutAttempt.created_at.desc())
        .all()
    )

    conversion_jobs = db.query(ConversionJob).filter(ConversionJob.user_id == user.id).all()
    edit_jobs = db.query(PdfEditJob).filter(PdfEditJob.user_id == user.id).all()

    jobs = [
        JobUsageOut(
            kind="conversion",
            id=job.id,
            original_filename=job.original_filename,
            status=job.status,
            created_at=job.created_at,
            downloaded_at=job.downloaded_at,
        )
        for job in conversion_jobs
    ] + [
        JobUsageOut(
            kind="edit",
            id=job.id,
            original_filename=job.original_filename,
            status=job.status,
            created_at=job.created_at,
            downloaded_at=job.downloaded_at,
        )
        for job in edit_jobs
    ]
    jobs.sort(key=lambda j: j.created_at, reverse=True)

    return AdminLookupOut(
        user_id=user.id,
        email=user.email,
        created_at=user.created_at,
        stripe_customer_id=user.stripe_customer_id,
        subscription=subscription_out,
        checkout_attempts=checkout_attempts,
        jobs=jobs,
    )


@router.get("/lookup", response_model=AdminLookupOut)
def lookup(email: str, db: Session = Depends(get_db)):
    return _lookup_data(email, db)


def _fmt(dt) -> str:
    return dt.strftime("%d/%m/%Y %H:%M") if dt else "—"


def _build_evidence_lines(data: AdminLookupOut) -> list[str]:
    lines = [
        f"Cliente: {data.email} (usuario #{data.user_id}, registrado el {_fmt(data.created_at)})",
    ]
    if data.subscription:
        s = data.subscription
        lines.append(
            f"Suscripción: plan {s.plan_name} ({s.plan_code}), estado {s.status}, "
            f"ID {s.stripe_subscription_id or '—'}"
        )
    lines.append("")
    lines.append("Intentos de checkout:")
    if not data.checkout_attempts:
        lines.append("  (ninguno registrado)")
    for a in data.checkout_attempts:
        lines.append(f"  - {_fmt(a.created_at)} | sesión {a.stripe_checkout_session_id}")
        lines.append(f"    IP: {a.ip_address or '—'} | User-Agent: {a.user_agent or '—'}")
        lines.append(
            f"    3DS: {a.three_ds_result or '—'} | CVC: {a.cvc_check or '—'} | "
            f"AVS línea: {a.avs_line1_check or '—'} | AVS CP: {a.avs_postal_check or '—'}"
        )
        lines.append(f"    Cargo: {a.stripe_charge_id or '—'} | Completado: {_fmt(a.completed_at)}")
    lines.append("")
    lines.append("Uso del producto (¿descargó algo?):")
    if not data.jobs:
        lines.append("  (sin trabajos)")
    for j in data.jobs:
        kind = "conversión" if j.kind == "conversion" else "edición"
        downloaded = _fmt(j.downloaded_at) if j.downloaded_at else "nunca"
        lines.append(f"  - [{kind}] {j.original_filename} — creado {_fmt(j.created_at)}, descargado: {downloaded}")
    return lines


@router.get("/lookup/pdf")
def lookup_pdf(email: str, db: Session = Depends(get_db)):
    data = _lookup_data(email, db)
    lines = _build_evidence_lines(data)
    pdf_bytes = pdf_editor.render_text_pdf(f"Evidencia de disputa — {data.email}", lines)
    safe_email = data.email.replace("@", "_at_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="evidencia_{safe_email}.pdf"'},
    )
