import shutil
from pathlib import Path

from app.core.config import settings


def job_dir(job_id: int) -> Path:
    path = Path(settings.storage_dir) / str(job_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_upload(job_id: int, filename: str, content: bytes) -> str:
    directory = job_dir(job_id)
    input_path = directory / f"input__{filename}"
    input_path.write_bytes(content)
    return str(input_path)


def output_dir_for(job_id: int) -> str:
    return str(job_dir(job_id))


def delete_job_dir(job_id: int) -> None:
    shutil.rmtree(Path(settings.storage_dir) / str(job_id), ignore_errors=True)


def file_exists(path: str | None) -> bool:
    return bool(path) and Path(path).is_file()


def edit_job_dir(job_id: int) -> Path:
    path = Path(settings.storage_dir) / "edits" / str(job_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_edit_upload(job_id: int, filename: str, content: bytes) -> str:
    directory = edit_job_dir(job_id)
    input_path = directory / f"working__{filename}"
    input_path.write_bytes(content)
    return str(input_path)


def delete_edit_job_dir(job_id: int) -> None:
    shutil.rmtree(Path(settings.storage_dir) / "edits" / str(job_id), ignore_errors=True)
