"""Pydantic v2 schemas for the Quotation module."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.enums.quotation import QuotationStatus


class QuotationItemCreate(BaseModel):
    """Add a line item to a quotation."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "product_id": "33333333-3333-3333-3333-333333333333",
                    "quantity": 3,
                    "unit_price": "2500.00",
                    "description": (
                        "White aluminum frame\n"
                        "Double glazed glass\n"
                        "Mosquito screen"
                    ),
                    "notes": "Installation included",
                }
            ]
        }
    )

    product_id: uuid.UUID = Field(description="Existing catalog product UUID.")
    quantity: int = Field(default=1, ge=1, description="Line quantity.")
    unit_price: Decimal = Field(
        ...,
        ge=0,
        description="Unit price for this customized line (stored on the item).",
        examples=["2500.00"],
    )
    description: str | None = Field(
        default=None,
        max_length=500,
        description="Customization details for this product line.",
    )
    notes: str | None = Field(default=None, description="Internal item notes.")


class QuotationItemUpdate(BaseModel):
    """Partial update for a quotation line item."""

    product_id: uuid.UUID | None = None
    quantity: int | None = Field(default=None, ge=1)
    unit_price: Decimal | None = Field(default=None, ge=0)
    description: str | None = Field(default=None, max_length=500)
    notes: str | None = None


class QuotationItemRead(BaseModel):
    """Quotation line item resource."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quotation_id: uuid.UUID
    product_id: uuid.UUID
    quantity: int
    unit_price: Decimal
    total_price: Decimal
    description: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class QuotationItemListResponse(BaseModel):
    """List of items for one quotation."""

    items: list[QuotationItemRead]
    total: int


class QuotationCreate(BaseModel):
    """Create a draft quotation (add items via the items API)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "customer_id": "11111111-1111-1111-1111-111111111111",
                    "quotation_date": "2026-07-18",
                    "discount": "0.00",
                    "notes": "Initial estimate",
                }
            ]
        }
    )

    customer_id: uuid.UUID = Field(description="Existing customer UUID.")
    quotation_number: str | None = Field(
        default=None,
        max_length=50,
        description="Optional unique number; auto-generated when omitted.",
    )
    quotation_date: date | None = Field(
        default=None,
        description="Defaults to today when omitted.",
    )
    discount: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        description="Absolute discount amount (not percent).",
    )
    notes: str | None = None


class QuotationUpdate(BaseModel):
    """Update editable quotation fields (not status — use PATCH /status)."""

    quotation_date: date | None = None
    discount: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None


class QuotationStatusUpdate(BaseModel):
    """Request body for status transitions."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"status": "waiting_for_measurement"},
                {"status": "measured"},
                {"status": "under_negotiation"},
                {"status": "sent"},
                {"status": "approved"},
            ]
        }
    )

    status: QuotationStatus = Field(
        description=(
            "Target status. Full lifecycle: draft → waiting_for_measurement → "
            "measured → under_negotiation ↔ sent → approved | rejected | "
            "cancelled. Terminal: approved, rejected, cancelled, expired."
        ),
    )


class QuotationRead(BaseModel):
    """Quotation resource."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quotation_number: str
    customer_id: uuid.UUID
    quotation_date: date
    status: QuotationStatus
    total_price: Decimal
    discount: Decimal
    final_price: Decimal
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class QuotationDetailRead(QuotationRead):
    """Quotation with embedded line items."""

    items: list[QuotationItemRead] = Field(default_factory=list)


class QuotationListResponse(BaseModel):
    """Paginated quotation list."""

    items: list[QuotationRead]
    total: int
    limit: int
    offset: int


class QuotationWithJobResponse(BaseModel):
    """
    Response when quotation status update creates a job.
    
    When a quotation is approved, the system automatically creates
    a job and returns both the quotation and the newly created job.
    """

    quotation: QuotationRead
    job: JobRead | None = Field(
        default=None,
        description="Job created when quotation was approved (null for other status changes)",
    )

    model_config = ConfigDict(from_attributes=True)


# Import at end to avoid circular dependency
from app.schemas.job import JobRead  # noqa: E402

# Rebuild model to resolve forward references
QuotationWithJobResponse.model_rebuild()

