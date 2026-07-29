from datetime import datetime

from pydantic import BaseModel


class PdfEditJobOut(BaseModel):
    id: int
    status: str
    original_filename: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AddTextRequest(BaseModel):
    page_number: int
    x: float
    y: float
    text: str
    font_size: float = 12


class RotateRequest(BaseModel):
    page_number: int
    degrees: int


class ReorderRequest(BaseModel):
    new_order: list[int]


class FillFormRequest(BaseModel):
    fields: dict[str, str]


class SplitRequest(BaseModel):
    start_page: int
    end_page: int


class FormFieldOut(BaseModel):
    name: str | None
    type: str | None
    page: int
    value: str


class TextLookupRequest(BaseModel):
    page_number: int
    x: float
    y: float


class TextSpanOut(BaseModel):
    text: str
    font: str
    size: float
    color: str
    bbox: list[float]
    origin: list[float]
    bold: bool
    italic: bool


class ReplaceTextRequest(BaseModel):
    page_number: int
    bbox: list[float]
    origin: list[float]
    text: str
    font_size: float
    color: str
    original_font: str = ""
    bold: bool = False
    italic: bool = False
