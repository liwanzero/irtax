from datetime import datetime

from pydantic import BaseModel


class ConversionJobOut(BaseModel):
    id: int
    direction: str
    status: str
    original_filename: str
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}
