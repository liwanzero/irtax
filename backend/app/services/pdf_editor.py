import os

import fitz  # PyMuPDF

PREVIEW_DPI = 100
POINTS_PER_PIXEL_AT_PREVIEW_DPI = 72 / PREVIEW_DPI


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


def render_preview(pdf_path: str, dpi: int = PREVIEW_DPI) -> list[bytes]:
    doc = fitz.open(pdf_path)
    try:
        return [page.get_pixmap(dpi=dpi).tobytes("png") for page in doc]
    finally:
        doc.close()


def _color_int_to_hex(color_int: int) -> str:
    r = (color_int >> 16) & 255
    g = (color_int >> 8) & 255
    b = color_int & 255
    return f"#{r:02x}{g:02x}{b:02x}"


def _hex_to_rgb01(hex_color: str) -> tuple[float, float, float]:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        raise EditorError("Color inválido, se esperaba un hex como #ff0000")
    r = int(hex_color[0:2], 16) / 255
    g = int(hex_color[2:4], 16) / 255
    b = int(hex_color[4:6], 16) / 255
    return (r, g, b)


def guess_base14_font(original_font_name: str, bold: bool, italic: bool) -> str:
    """PyMuPDF can only insert its built-in Base14 fonts by name (it can't reuse an
    arbitrary embedded font from the original PDF through this API), so we pick the
    closest built-in family from the detected font's name and requested style."""
    name = (original_font_name or "").lower()
    if "courier" in name or "mono" in name:
        return {("no", "no"): "cour", ("yes", "no"): "cobo", ("no", "yes"): "coit", ("yes", "yes"): "cobi"}[
            ("yes" if bold else "no", "yes" if italic else "no")
        ]
    if "times" in name or "serif" in name or "georgia" in name or "garamond" in name:
        return {("no", "no"): "tiro", ("yes", "no"): "tibo", ("no", "yes"): "tiit", ("yes", "yes"): "tibi"}[
            ("yes" if bold else "no", "yes" if italic else "no")
        ]
    return {("no", "no"): "helv", ("yes", "no"): "hebo", ("no", "yes"): "heit", ("yes", "yes"): "hebi"}[
        ("yes" if bold else "no", "yes" if italic else "no")
    ]


def find_text_at_point(pdf_path: str, page_number: int, x: float, y: float) -> dict | None:
    doc = fitz.open(pdf_path)
    try:
        page = _get_page(doc, page_number)
        point = fitz.Point(x, y)
        for block in page.get_text("dict").get("blocks", []):
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    if fitz.Rect(span["bbox"]).contains(point):
                        font_lower = span["font"].lower()
                        return {
                            "text": span["text"],
                            "font": span["font"],
                            "size": round(span["size"], 1),
                            "color": _color_int_to_hex(span["color"]),
                            "bbox": list(span["bbox"]),
                            "origin": list(span["origin"]),
                            "bold": "bold" in font_lower,
                            "italic": "italic" in font_lower or "oblique" in font_lower,
                        }
        return None
    finally:
        doc.close()


def replace_text(
    pdf_path: str,
    page_number: int,
    bbox: list[float],
    origin: list[float],
    new_text: str,
    font_size: float,
    color_hex: str,
    original_font: str = "",
    bold: bool = False,
    italic: bool = False,
) -> None:
    doc = fitz.open(pdf_path)
    try:
        page = _get_page(doc, page_number)
        rect = fitz.Rect(bbox)
        # Redaction removes the original text from the content stream (not just paints
        # over it) and fills the area white, then we draw the replacement in its place.
        page.add_redact_annot(rect, fill=(1, 1, 1))
        page.apply_redactions()
        color = _hex_to_rgb01(color_hex)
        fontname = guess_base14_font(original_font, bold, italic)
        page.insert_text((origin[0], origin[1]), new_text, fontsize=font_size, color=color, fontname=fontname)
        _save_in_place(doc, pdf_path)
    finally:
        doc.close()


def list_form_fields(pdf_path: str) -> list[dict]:
    doc = fitz.open(pdf_path)
    try:
        fields = []
        for page_index, page in enumerate(doc):
            for widget in page.widgets() or []:
                fields.append(
                    {
                        "name": widget.field_name,
                        "type": widget.field_type_string,
                        "page": page_index,
                        "value": widget.field_value or "",
                    }
                )
        return fields
    finally:
        doc.close()
