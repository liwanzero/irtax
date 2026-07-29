from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.conversion_job import ConversionJob
from app.services import conversion, storage


def process_conversion_job(job_id: int) -> None:
    db = SessionLocal()
    try:
        job = db.get(ConversionJob, job_id)
        if job is None:
            return

        job.status = "processing"
        db.commit()

        try:
            if job.direction == "pdf2word":
                output_path = str(Path(job.input_path).parent / "output.docx")
                conversion.convert_pdf_to_word(job.input_path, output_path)
            elif job.direction == "word2pdf":
                output_path = conversion.convert_word_to_pdf(job.input_path, job.id)
            else:
                raise conversion.ConversionError(f"Dirección de conversión desconocida: {job.direction}")

            job.output_path = output_path
            job.status = "done"
        except conversion.ConversionError as exc:
            job.status = "error"
            job.error_message = str(exc)
        except Exception as exc:  # unexpected failure, still surface it to the user
            job.status = "error"
            job.error_message = f"Error inesperado durante la conversión: {exc}"

        job.completed_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()


def cleanup_expired_files() -> None:
    """Deletes on-disk files for jobs older than FILE_RETENTION_HOURS. Job history stays in the DB."""
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.file_retention_hours)
        stale_jobs = (
            db.query(ConversionJob)
            .filter(
                ConversionJob.completed_at.isnot(None),
                ConversionJob.completed_at < cutoff,
                ConversionJob.output_path.isnot(None),
            )
            .all()
        )
        for job in stale_jobs:
            storage.delete_job_dir(job.id)
            job.output_path = None
        db.commit()
    finally:
        db.close()
