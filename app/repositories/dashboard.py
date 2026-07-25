"""Dashboard repository."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import Select, and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.enums.job import JobStatus
from app.enums.payment import PaymentStatus, PaymentType
from app.enums.quotation import QuotationStatus
from app.models.activity_log import ActivityLog
from app.models.customer import Customer
from app.models.job import Job
from app.models.payment import Payment
from app.models.quotation import Quotation


def _utcnow() -> datetime:
    """Return current UTC time (timezone-aware)."""
    return datetime.now(tz=timezone.utc)


class DashboardRepository:
    """
    Data access for dashboard metrics.
    
    Responsibilities:
    - Execute optimized SQL queries with JOINs and aggregations
    - Eager-load relationships to avoid N+1 problems
    - Return raw data structures for service layer processing
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_kpi_counts(self) -> dict[str, int]:
        """
        Calculate all KPIs in a single optimized query.
        
        Returns dict with keys:
        - total_active_jobs
        - measurements_scheduled_today
        - installations_scheduled_today
        - overdue_payments
        """
        today = date.today()
        
        # Active job statuses (exclude completed and cancelled)
        active_statuses = [
            JobStatus.PENDING,
            JobStatus.MEASURING,
            JobStatus.IN_PRODUCTION,
            JobStatus.READY_FOR_INSTALLATION,
            JobStatus.INSTALLED,
        ]
        
        # Count active jobs
        active_jobs_stmt = (
            select(func.count(Job.id))
            .where(Job.status.in_(active_statuses))
        )
        active_jobs_result = await self._session.execute(active_jobs_stmt)
        total_active_jobs = active_jobs_result.scalar_one()
        
        # Count measurements scheduled today
        measurements_today_stmt = (
            select(func.count(Job.id))
            .where(
                and_(
                    Job.measurement_date == today,
                    Job.status.in_(active_statuses),
                )
            )
        )
        measurements_result = await self._session.execute(measurements_today_stmt)
        measurements_today = measurements_result.scalar_one()
        
        # Count installations scheduled today
        installations_today_stmt = (
            select(func.count(Job.id))
            .where(
                and_(
                    Job.installation_date == today,
                    Job.status.in_(active_statuses),
                )
            )
        )
        installations_result = await self._session.execute(installations_today_stmt)
        installations_today = installations_result.scalar_one()
        
        # Count overdue payments
        overdue_payments_stmt = (
            select(func.count(Payment.id))
            .where(Payment.status == PaymentStatus.OVERDUE)
        )
        overdue_payments_result = await self._session.execute(overdue_payments_stmt)
        overdue_payments = overdue_payments_result.scalar_one()
        
        return {
            "total_active_jobs": total_active_jobs,
            "measurements_scheduled_today": measurements_today,
            "installations_scheduled_today": installations_today,
            "overdue_payments": overdue_payments,
        }


    async def get_quotations_waiting_count(self) -> int:
        """Count quotations waiting for customer response."""
        waiting_statuses = [QuotationStatus.SENT, QuotationStatus.UNDER_NEGOTIATION]
        
        stmt = (
            select(func.count(Quotation.id))
            .where(Quotation.status.in_(waiting_statuses))
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def get_active_jobs_with_relations(self) -> list[Job]:
        """
        Fetch all active jobs with eager-loaded relationships.
        
        Loads:
        - quotation → customer
        - payments
        - measurements
        - activity_logs (latest only)
        """
        seven_days_ago = date.today() - timedelta(days=7)
        
        # Include completed jobs from last 7 days
        stmt = (
            select(Job)
            .options(
                joinedload(Job.quotation).joinedload(Quotation.customer),
                selectinload(Job.payments),
                selectinload(Job.measurements),
                selectinload(Job.activity_logs),
            )
            .where(
                or_(
                    Job.status.in_([
                        JobStatus.PENDING,
                        JobStatus.MEASURING,
                        JobStatus.IN_PRODUCTION,
                        JobStatus.READY_FOR_INSTALLATION,
                        JobStatus.INSTALLED,
                        JobStatus.CANCELLED,
                    ]),
                    and_(
                        Job.status == JobStatus.COMPLETED,
                        Job.completion_date >= seven_days_ago,
                    ),
                )
            )
            .order_by(Job.created_at.desc())
        )
        
        result = await self._session.execute(stmt)
        return list(result.unique().scalars().all())

    async def get_overdue_payments_with_job(self) -> list[Payment]:
        """Fetch overdue payments with job and customer relations."""
        stmt = (
            select(Payment)
            .options(
                joinedload(Payment.job)
                .joinedload(Job.quotation)
                .joinedload(Quotation.customer)
            )
            .where(Payment.status == PaymentStatus.OVERDUE)
            .order_by(Payment.due_date.asc())
        )
        
        result = await self._session.execute(stmt)
        return list(result.unique().scalars().all())

    async def get_stale_quotations(self, days_threshold: int = 14) -> list[Quotation]:
        """Fetch quotations that have been sent but not responded to."""
        threshold_date = _utcnow() - timedelta(days=days_threshold)
        
        stmt = (
            select(Quotation)
            .options(joinedload(Quotation.customer))
            .where(
                and_(
                    Quotation.status == QuotationStatus.SENT,
                    Quotation.updated_at <= threshold_date,
                )
            )
            .order_by(Quotation.updated_at.asc())
        )
        
        result = await self._session.execute(stmt)
        return list(result.unique().scalars().all())

    async def get_recent_activity_logs(self, limit: int = 10) -> list[ActivityLog]:
        """
        Fetch recent activity logs with eager-loaded job and customer.
        
        Returns activities ordered by created_at descending.
        """
        stmt = (
            select(ActivityLog)
            .options(
                joinedload(ActivityLog.job)
                .joinedload(Job.quotation)
                .joinedload(Quotation.customer)
            )
            .order_by(ActivityLog.created_at.desc())
            .limit(limit)
        )
        
        result = await self._session.execute(stmt)
        return list(result.unique().scalars().all())
