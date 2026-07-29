import shutil
import subprocess
import uuid
from pathlib import Path

import docx
import fitz  # PyMuPDF
import ocrmypdf
from pdf2docx import Converter

LIBREOFFICE_TIMEOUT_SECONDS = 180
MIN_CHARS_PER_PAGE_FOR_TEXT_PDF = 20


class ConversionError(Exception):
    pass


def _pages_are_scanned(doc) -> bool:
    """Heuristic: a PDF whose pages carry almost no extractable text is treated as scanned."""
    if doc.page_count == 0:
        return False
    total_chars = sum(len(page.get_text().strip()) for page in doc)
    return (total_chars / doc.page_count) < MIN_CHARS_PER_PAGE_FOR_TEXT_PDF


def is_scanned_pdf(pdf_path: str) -> bool:
    doc = fitz.open(pdf_path)
    try:
        return _pages_are_scanned(doc)
    finally:
        doc.close()


def is_scanned_pdf_bytes(content: bytes) -> bool:
    """Same check without writing to disk first — used to gate uploads before a job exists."""
    doc = fitz.open(stream=content, filetype="pdf")
    try:
        return _pages_are_scanned(doc)
    finally:
        doc.close()


def convert_pdf_to_word(input_path: str, output_path: str) -> None:
    """Converts a PDF to .docx. Scanned/image-only PDFs are OCR'd and rebuilt from the
    recognized text directly, since OCR text layers are invisible and pdf2docx's layout
    engine ignores non-visible text runs."""
    if is_scanned_pdf(input_path):
        _convert_scanned_pdf_to_word(input_path, output_path)
        return

    try:
        converter = Converter(input_path)
        try:
            converter.convert(output_path)
        finally:
            converter.close()
    except Exception as exc:
        raise ConversionError(f"La conversión de PDF a Word falló: {exc}") from exc


def _convert_scanned_pdf_to_word(input_path: str, output_path: str) -> None:
    ocred_pdf = str(Path(input_path).with_suffix(".ocr.pdf"))
    sidecar_path = str(Path(input_path).with_suffix(".sidecar.txt"))
    try:
        ocrmypdf.ocr(
            input_path,
            ocred_pdf,
            force_ocr=True,
            deskew=True,
            clean=True,
            language="spa+eng",
            progress_bar=False,
            sidecar=sidecar_path,
        )
    except Exception as exc:  # ocrmypdf raises several distinct exception types
        raise ConversionError(f"El OCR del PDF falló: {exc}") from exc

    recognized_text = Path(sidecar_path).read_text(encoding="utf-8", errors="ignore")

    document = docx.Document()
    pages = recognized_text.split("\x0c")  # ocrmypdf separates pages with a form feed
    for i, page_text in enumerate(pages):
        for line in page_text.splitlines():
            if line.strip():
                document.add_paragraph(line)
        if i < len(pages) - 1:
            document.add_page_break()
    document.save(output_path)


def convert_word_to_pdf(input_path: str, job_id: int) -> str:
    """Converts a Word document to PDF via headless LibreOffice. Returns the produced PDF path."""
    output_dir = str(Path(input_path).parent)
    profile_dir = Path("/tmp") / f"lo-profile-{job_id}-{uuid.uuid4().hex}"

    cmd = [
        "soffice",
        "--headless",
        "--norestore",
        f"-env:UserInstallation=file://{profile_dir}",
        "--convert-to",
        "pdf",
        "--outdir",
        output_dir,
        input_path,
    ]
    try:
        result = subprocess.run(cmd, timeout=LIBREOFFICE_TIMEOUT_SECONDS, capture_output=True)
    except subprocess.TimeoutExpired as exc:
        raise ConversionError("La conversión de Word a PDF superó el tiempo límite") from exc
    finally:
        shutil.rmtree(profile_dir, ignore_errors=True)

    if result.returncode != 0:
        stderr = result.stderr.decode(errors="ignore")
        raise ConversionError(f"LibreOffice falló al convertir el documento: {stderr}")

    produced_path = Path(output_dir) / f"{Path(input_path).stem}.pdf"
    if not produced_path.is_file():
        raise ConversionError("LibreOffice no generó el archivo PDF esperado")

    return str(produced_path)
