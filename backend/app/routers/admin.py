from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.session import get_db
from app.models.checkout_attempt import CheckoutAttempt
from app.models.conversion_job import ConversionJob
from app.models.pdf_edit_job import PdfEditJob
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.admin import AdminLookupOut, JobUsageOut, SubscriptionSummaryOut

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/lookup", response_model=AdminLookupOut)
def lookup(email: str, db: Session = Depends(get_db)):
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
