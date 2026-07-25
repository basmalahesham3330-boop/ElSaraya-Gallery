"""
Workflow stage mapping - SINGLE SOURCE OF TRUTH.

This module contains the canonical workflow stage mapping logic.
All features (dashboard, KPIs, filters, reports) MUST use these functions.
DO NOT duplicate this logic elsewhere.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from app.enums.job import JobStatus
from app.enums.payment import PaymentStatus, PaymentType
from app.enums.quotation import QuotationStatus

if TYPE_CHECKING:
    from app.models.job import Job


def _utcnow() -> datetime:
    """Return current UTC time (timezone-aware)."""
    return datetime.now(tz=timezone.utc)


def map_job_to_workflow_stage(job: Job) -> str | None:
    """
    Map job and quotation status to workflow stage.
    
    **SINGLE SOURCE OF TRUTH** - All KPIs, filters, and visualizations MUST use this.
    
    Workflow Stages (Pipeline Board columns):
    - ``quotation``: Jobs pending quotation approval
    - ``measurement``: Jobs in measuring phase
    - ``deposit_received``: Deposit paid, waiting to start manufacturing
    - ``manufacturing``: Currently in production (after deposit paid)
    - ``installation``: Ready for installation or being installed
    - ``completed``: Recently completed (last 7 days)
    - ``postponed``: Cancelled jobs ONLY
    - ``rejected``: Rejected quotations ONLY
    
    Returns:
        Workflow stage name (str) or None if job should be hidden
    
    Examples:
        >>> job.status = JobStatus.PENDING
        >>> map_job_to_workflow_stage(job)
        'quotation'
        
        >>> job.status = JobStatus.IN_PRODUCTION
        >>> job.payments = [Payment(payment_type=PaymentType.DEPOSIT, status=PaymentStatus.PAID)]
        >>> map_job_to_workflow_stage(job)
        'manufacturing'
    """
    # ===================================================================
    # REJECTED COLUMN: Rejected quotations ONLY
    # ===================================================================
    if job.quotation.status == QuotationStatus.REJECTED:
        return "rejected"
    
    # ===================================================================
    # POSTPONED COLUMN: Cancelled jobs ONLY (not rejected quotations)
    # ===================================================================
    if job.status == JobStatus.CANCELLED:
        return "postponed"
    
    # ===================================================================
    # Hide cancelled/expired quotations
    # ===================================================================
    if job.quotation.status in (QuotationStatus.CANCELLED, QuotationStatus.EXPIRED):
        return None  # Don't show these
    
    # ===================================================================
    # COMPLETED COLUMN: Recently completed jobs (last 7 days)
    # ===================================================================
    if job.status == JobStatus.COMPLETED:
        if job.completion_date:
            days_since_completion = (_utcnow().date() - job.completion_date).days
            if days_since_completion <= 7:
                return "completed"
        return None  # Hide old completed jobs
    
    # ===================================================================
    # WORKFLOW STAGE MAPPING based on Job Status
    # ===================================================================
    
    # QUOTATION COLUMN: Pending approval
    if job.status == JobStatus.PENDING:
        return "quotation"
    
    # MEASUREMENT COLUMN: Measuring phase
    if job.status == JobStatus.MEASURING:
        return "measurement"
    
    # IN_PRODUCTION status maps to DEPOSIT_RECEIVED or MANUFACTURING
    # based on whether deposit payment has been made
    if job.status == JobStatus.IN_PRODUCTION:
        # Check if deposit payment exists and is paid
        deposit_payment = next(
            (p for p in job.payments if p.payment_type == PaymentType.DEPOSIT),
            None
        )
        if deposit_payment and deposit_payment.status == PaymentStatus.PAID:
            # Deposit paid → IN MANUFACTURING
            return "manufacturing"
        else:
            # No deposit paid yet → WAITING FOR DEPOSIT
            return "deposit_received"
    
    # INSTALLATION COLUMN: Ready for installation OR being installed
    if job.status == JobStatus.READY_FOR_INSTALLATION:
        return "installation"
    
    if job.status == JobStatus.INSTALLED:
        return "installation"
    
    # Unknown status - hide
    return None


# Workflow stage labels for UI
WORKFLOW_STAGE_LABELS: dict[str, str] = {
    "quotation": "عرض السعر",
    "measurement": "القياس",
    "deposit_received": "دفعة مقدمة",
    "manufacturing": "التصنيع",
    "installation": "التركيب",
    "completed": "مكتمل",
    "postponed": "مؤجل",
    "rejected": "مرفوض",
}


# Valid workflow stages
WORKFLOW_STAGES: frozenset[str] = frozenset(WORKFLOW_STAGE_LABELS.keys())


def is_valid_workflow_stage(stage: str) -> bool:
    """Check if a stage name is valid."""
    return stage in WORKFLOW_STAGES


def get_workflow_stage_label(stage: str) -> str:
    """Get the Arabic label for a workflow stage."""
    return WORKFLOW_STAGE_LABELS.get(stage, stage)
