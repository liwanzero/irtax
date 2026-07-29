import os

import fitz  # PyMuPDF


class EditorError(Exception):
    pass


def _save_in_place(doc: "fitz.Document", pdf_path: str) -> None:
    tmp_path = f"{pdf_path}.tmp"
    doc.save(tmp_path)
    os.replace(tmp_path, pdf_path)


def _get_page(doc: "fitz.Document", page_number: int):
    if page_number < 0 or page_number >= doc.page_count:
        raise EditorError(f"Número de página inválido (el documento tiene {doc.page_count} páginas)")
    return doc[page_number]


def add_text(pdf_path: str, page_number: int, x: float, y: float, text: str, font_size: float = 12) -> None:
    doc = fitz.open(pdf_path)
    try:
        page = _get_page(doc, page_number)
        page.insert_text((x, y), text, fontsize=font_size)
        _save_in_place(doc, pdf_path)
    finally:
        doc.close()


def add_image(pdf_path: str, page_number: int, x: float, y: float, width: float, height: float, image_bytes: bytes) -> None:
    doc = fitz.open(pdf_path)
    try:
        page = _get_page(doc, page_number)
        rect = fitz.Rect(x, y, x + width, y + height)
        page.insert_image(rect, stream=image_bytes)
        _save_in_place(doc, pdf_path)
    finally:
        doc.close()


def rotate_page(pdf_path: str, page_number: int, degrees: int) -> None:
    doc = fitz.open(pdf_path)
    try:
        page = _get_page(doc, page_number)
        page.set_rotation((page.rotation + degrees) % 360)
        _save_in_place(doc, pdf_path)
    finally:
        doc.close()


def merge_pdf(pdf_path: str, other_pdf_bytes: bytes) -> None:
    doc = fitz.open(pdf_path)
    other = fitz.open(stream=other_pdf_bytes, filetype="pdf")
    try:
        doc.insert_pdf(other)
        _save_in_place(doc, pdf_path)
    finally:
        other.close()
        doc.close()


def split_pages(pdf_path: str, start_page: int, end_page: int) -> bytes:
    """Extracts pages [start_page, end_page] (0-indexed, inclusive) into a new PDF's bytes,
    without modifying the job's working file."""
    doc = fitz.open(pdf_path)
    try:
        if start_page < 0 or end_page >= doc.page_count or start_page > end_page:
            raise EditorError("Rango de páginas inválido")
        new_doc = fitz.open()
        try:
            new_doc.insert_pdf(doc, from_page=start_page, to_page=end_page)
            return new_doc.tobytes()
        finally:
            new_doc.close()
    finally:
        doc.close()


def reorder_pages(pdf_path: str, new_order: list[int]) -> None:
    doc = fitz.open(pdf_path)
    try:
        if sorted(new_order) != list(range(doc.page_count)):
            raise EditorError("El nuevo orden debe incluir cada página del documento exactamente una vez")
        doc.select(new_order)
        _save_in_place(doc, pdf_path)
    finally:
        doc.close()


def fill_form_fields(pdf_path: str, field_values: dict[str, str]) -> None:
    doc = fitz.open(pdf_path)
    try:
        filled_any = False
        for page in doc:
            for widget in page.widgets() or []:
                if widget.field_name in field_values:
                    widget.field_value = field_values[widget.field_name]
                    widget.update()
                    filled_any = True
        if not filled_any:
            raise EditorError("No se encontraron campos de formulario con esos nombres en el PDF")
        _save_in_place(doc, pdf_path)
    finally:
        doc.close()


def render_preview(pdf_path: str, dpi: int = 100) -> list[bytes]:
    doc = fitz.open(pdf_path)
    try:
        return [page.get_pixmap(dpi=dpi).tobytes("png") for page in doc]
    finally:
        doc.close()
