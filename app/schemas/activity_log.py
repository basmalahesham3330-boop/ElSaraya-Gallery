"""Activity Log schemas for request/response validation."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ActivityLogRead(BaseModel):
    """Activity log response."""

    id: UUID
    job_id: UUID
    action: str
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityLogListResponse(BaseModel):
    """Paginated activity log list."""

    items: list[ActivityLogRead]
    total: int
    limit: int
    offset: int
