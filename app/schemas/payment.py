"""Payment schemas for request/response validation."""
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.enums.payment import PaymentMethod, PaymentStatus, PaymentType


class PaymentCreate(BaseModel):
    """Create payment for a job."""

    # Note: job_id comes from URL path parameter, not request body
    payment_type: PaymentType = Field(..., description="Payment type (deposit, production, final)")
    payment_method: PaymentMethod = Field(..., description="Payment method (cash, bank_transfer, etc.)")
    percentage: Decimal = Field(..., description="Payment percentage (0-100)", gt=0, le=100)
    amount: Decimal = Field(..., description="Payment amount", ge=0)
    due_date: date | None = Field(None, description="Payment due date")
    paid_date: date | None = Field(None, description="Date payment was received")
    notes: str | None = Field(None, description="Payment notes", max_length=5000)


class PaymentUpdate(BaseModel):
    """Update payment details."""

    payment_type: PaymentType | None = Field(None, description="Payment type")
    payment_method: PaymentMethod | None = Field(None, description="Payment method")
    percentage: Decimal | None = Field(None, description="Payment percentage (0-100)", gt=0, le=100)
    amount: Decimal | None = Field(None, description="Payment amount", ge=0)
    due_date: date | None = Field(None, description="Payment due date")
    paid_date: date | None = Field(None, description="Date payment was received")
    notes: str | None = Field(None, description="Payment notes", max_length=5000)


class PaymentStatusUpdate(BaseModel):
    """Update payment status."""

    status: PaymentStatus = Field(..., description="New payment status")


class PaymentRead(BaseModel):
    """Payment response."""

    id: UUID
    job_id: UUID
    payment_order: int
    payment_type: PaymentType
    payment_method: PaymentMethod
    percentage: Decimal
    amount: Decimal
    due_date: date | None
    paid_date: date | None
    status: PaymentStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaymentListResponse(BaseModel):
    """Paginated payment list."""

    items: list[PaymentRead]
    total: int
    limit: int
    offset: int
