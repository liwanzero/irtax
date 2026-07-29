FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive

# System deps:
# - tesseract-ocr (+ spa/eng language packs): OCR engine used by ocrmypdf
# - ghostscript, qpdf, unpaper: required by ocrmypdf for PDF rewriting/cleaning
# - libreoffice-writer (--no-install-recommends keeps it from pulling the whole suite):
#   headless Word -> PDF conversion
# - fonts-liberation: metric-compatible with common Word fonts, improves LibreOffice output fidelity
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-spa \
    tesseract-ocr-eng \
    ghostscript \
    qpdf \
    unpaper \
    libreoffice-writer \
    fonts-liberation \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
