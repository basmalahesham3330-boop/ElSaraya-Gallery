"""Dashboard service."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.workflow import map_job_to_workflow_stage
from app.enums.job import JobStatus
from app.enums.payment import PaymentStatus, PaymentType
from app.enums.quotation import QuotationStatus
from app.models.activity_log import ActivityLog
from app.models.job import Job
from app.models.payment import Payment
from app.models.quotation import Quotation
from app.repositories.dashboard import DashboardRepository
from app.schemas.dashboard import (
    ActivityDTO,
    AlertDTO,
    DashboardResponse,
    JobPipelineCardDTO,
    KPIsDTO,
    MetadataDTO,
    PaymentProgressDTO,
    PipelineDTO,
)


# Expected duration per stage (in days)
EXPECTED_DURATION: dict[JobStatus, int] = {
    JobStatus.PENDING: 7,
    JobStatus.MEASURING: 3,
    JobStatus.IN_PRODUCTION: 14,
    JobStatus.READY_FOR_INSTALLATION: 7,
    JobStatus.INSTALLED: 3,
}


def _utcnow() -> datetime:
    """Return current UTC time (timezone-aware)."""
    return datetime.now(tz=timezone.utc)


class DashboardService:
    """
    Dashboard business logic.
    
    Responsibilities:
    - Orchestrate data retrieval from repository
    - Calculate derived metrics (priority, payment progress, etc.)
    - Map pipeline stages to job status
    - Generate alerts based on business rules
    - Format activity with relative time
    - Assemble DashboardResponse DTO
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repository = DashboardRepository(session)

    async def get_dashboard_data(self) -> DashboardResponse:
        """
        Main entry point - orchestrates all data retrieval.
        
        Returns complete dashboard data in <500ms target.
        """
        start_time = _utcnow()
        
        try:
            # Fetch all data (3-4 queries total)
            kpi_counts = await self._repository.get_kpi_counts()
            quotations_waiting = await self._repository.get_quotations_waiting_count()
            active_jobs = await self._repository.get_active_jobs_with_relations()
            recent_activities = await self._repository.get_recent_activity_logs(limit=10)
        except Exception as e:
            # If database is not available, return empty but valid dashboard data
            # This allows the frontend to load without errors during development
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Database connection failed, returning empty dashboard: {e}")
            
            return DashboardResponse(
                kpis=KPIsDTO(
                    total_active_jobs=0,
                    pending_quotations=0,
                    measurements_scheduled_today=0,
                    installations_scheduled_today=0,
                    manufacturing_queue=0,
                    completed_last_7_days=0,
                    maintenance_jobs=0,
                    late_manufacturing=0,
                    overdue_payments=0,
                    delayed_projects=0,
                    projects_in_measurement=0,
                    projects_waiting_quotation=0,
                    projects_deposit_paid=0,
                    projects_in_manufacturing=0,
                    projects_in_installation=0,
                    projects_completed=0,
                    projects_postponed=0,
                    projects_rejected=0,
                ),
                pipeline=PipelineDTO(
                    quotation=[],
                    measurement=[],
                    depositReceived=[],
                    manufacturing=[],
                    installation=[],
                    completed=[],
                    postponed=[],
                    rejected=[],
                ),
                alerts=[],
                recentActivity=[],
                metadata=MetadataDTO(
                    generated_at=_utcnow(),
                    execution_time_ms=0,
                ),
            )
        
        # Build pipeline FIRST (single source of truth)
        pipeline = self._build_pipeline(active_jobs)
        
        # Calculate KPIs FROM pipeline (ensures they match)
        kpis = self._calculate_kpis_from_pipeline(pipeline, kpi_counts, quotations_waiting, active_jobs)
        
        # Generate alerts
        alerts = await self._generate_alerts(active_jobs)
        
        # Format activities
        formatted_activities = self._format_activities(recent_activities)
        
        # Calculate execution time
        execution_time = int((_utcnow() - start_time).total_seconds() * 1000)
        
        metadata = MetadataDTO(
            generated_at=_utcnow(),
            execution_time_ms=execution_time,
        )
        
        return DashboardResponse(
            kpis=kpis,
            pipeline=pipeline,
            alerts=alerts,
            recent_activity=formatted_activities,
            metadata=metadata,
        )


    def _calculate_kpis_from_pipeline(
        self,
        pipeline: PipelineDTO,
        kpi_counts: dict[str, int],
        quotations_waiting: int,
        active_jobs: list[Job],
    ) -> KPIsDTO:
        """
        Calculate operational KPIs from pipeline (single source of truth).
        
        KPIs MUST match pipeline card counts exactly.
        """
        # ===================================================================
        # WORKFLOW STAGE KPIs - Count from pipeline stages (exact match)
        # ===================================================================
        projects_in_measurement = len(pipeline.measurement)
        projects_waiting_quotation = len(pipeline.quotation)
        projects_deposit_paid = len(pipeline.deposit_received)
        projects_in_manufacturing = len(pipeline.manufacturing)
        projects_in_installation = len(pipeline.installation)
        projects_completed = len(pipeline.completed)
        projects_postponed = len(pipeline.postponed)
        projects_rejected = len(pipeline.rejected)
        
        # ===================================================================
        # OPERATIONAL KPIs
        # ===================================================================
        
        # Total active projects = all workflow stages except completed/postponed/rejected
        total_active_jobs = (
            projects_in_measurement +
            projects_waiting_quotation +
            projects_deposit_paid +
            projects_in_manufacturing +
            projects_in_installation
        )
        
        # Pending quotations = projects in quotation column
        pending_quotations = projects_waiting_quotation
        
        # Manufacturing queue = deposit paid + manufacturing columns
        manufacturing_queue = projects_deposit_paid + projects_in_manufacturing
        
        # Completed last 7 days = completed column (already filtered to 7 days)
        completed_last_7_days = projects_completed
        
        # Delayed projects (exceeding expected duration)
        delayed_projects = sum(
            1 for job in active_jobs
            if self._is_job_overdue(job) and job.status != JobStatus.COMPLETED
        )
        
        # Late manufacturing: deposit paid projects where production_start date has passed
        today = _utcnow().date()
        late_manufacturing = sum(
            1 for job in active_jobs
            # Must be in deposit_received stage
            if map_job_to_workflow_stage(job) == "deposit_received"
            # Must have production_start date
            and job.production_start is not None
            # Production start date has passed
            and job.production_start < today
        )
        
        # From repository queries (measurements/installations today, overdue payments)
        measurements_scheduled_today = kpi_counts["measurements_scheduled_today"]
        installations_scheduled_today = kpi_counts["installations_scheduled_today"]
        overdue_payments = kpi_counts["overdue_payments"]
        
        # Maintenance jobs - not implemented yet, return 0
        maintenance_jobs = 0
        
        return KPIsDTO(
            # Operational KPIs
            total_active_jobs=total_active_jobs,
            pending_quotations=pending_quotations,
            measurements_scheduled_today=measurements_scheduled_today,
            installations_scheduled_today=installations_scheduled_today,
            manufacturing_queue=manufacturing_queue,
            completed_last_7_days=completed_last_7_days,
            maintenance_jobs=maintenance_jobs,
            late_manufacturing=late_manufacturing,
            overdue_payments=overdue_payments,
            delayed_projects=delayed_projects,
            
            # Workflow Stage KPIs (match pipeline exactly)
            projects_in_measurement=projects_in_measurement,
            projects_waiting_quotation=projects_waiting_quotation,
            projects_deposit_paid=projects_deposit_paid,
            projects_in_manufacturing=projects_in_manufacturing,
            projects_in_installation=projects_in_installation,
            projects_completed=projects_completed,
            projects_postponed=projects_postponed,
            projects_rejected=projects_rejected,
        )

    def _build_pipeline(self, jobs: list[Job]) -> PipelineDTO:
        """
        Map jobs to pipeline stages using centralized workflow mapping.
        
        CORRECT BUSINESS WORKFLOW ORDER:
        1. measurement → 2. quotation → 3. deposit_received → 4. manufacturing
        → 5. installation → 6. completed
        Terminal states: postponed, rejected
        """
        pipeline: dict[str, list[JobPipelineCardDTO]] = {
            "measurement": [],
            "quotation": [],
            "deposit_received": [],
            "manufacturing": [],
            "installation": [],
            "completed": [],
            "postponed": [],
            "rejected": [],
        }
        
        for job in jobs:
            stage = map_job_to_workflow_stage(job)
            if stage is None:
                continue  # Skip jobs that shouldn't appear
            
            card = self._build_job_card(job)
            pipeline[stage].append(card)
        
        return PipelineDTO(**pipeline)

    def _build_job_card(self, job: Job) -> JobPipelineCardDTO:
        """Build job card DTO with all required information."""
        payment_progress = self._calculate_payment_progress(job)
        priority = self._calculate_job_priority(job)
        days_in_stage = self._calculate_days_in_stage(job)
        last_activity = self._get_last_activity_time(job)
        is_overdue = self._is_job_overdue(job)
        
        return JobPipelineCardDTO(
            job_id=str(job.id),
            job_number=f"J-{job.id.hex[:8].upper()}",  # Generate job number from ID
            quotation_number=job.quotation.quotation_number,
            customer_name=job.quotation.customer.full_name,
            current_status=job.status.value,
            assigned_engineer=None,  # Future: add engineer field to Job model
            last_activity=last_activity,
            days_in_stage=days_in_stage,
            payment_progress=payment_progress,
            priority=priority,
            measurement_date=job.measurement_date.isoformat() if job.measurement_date else None,
            installation_date=job.installation_date.isoformat() if job.installation_date else None,
            is_overdue=is_overdue,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )

    def _calculate_payment_progress(self, job: Job) -> PaymentProgressDTO:
        """Calculate payment progress for a job."""
        if not job.payments:
            return PaymentProgressDTO(
                paid=Decimal("0.00"),
                total=Decimal("0.00"),
                percentage=Decimal("0.00"),
            )
        
        total_amount = sum(p.amount for p in job.payments)
        paid_amount = sum(
            p.amount for p in job.payments
            if p.status == PaymentStatus.PAID
        )
        
        percentage = Decimal("0.00")
        if total_amount > 0:
            percentage = (paid_amount / total_amount * 100).quantize(Decimal("0.01"))
        
        return PaymentProgressDTO(
            paid=paid_amount,
            total=total_amount,
            percentage=percentage,
        )

    def _calculate_job_priority(self, job: Job) -> str:
        """
        Calculate job priority based on business rules.
        
        Returns: 'high' | 'medium' | 'low'
        """
        # High priority: Overdue or has overdue payments
        if self._is_job_overdue(job):
            return "high"
        
        overdue_payments = [
            p for p in job.payments
            if p.status == PaymentStatus.OVERDUE
        ]
        if overdue_payments:
            return "high"
        
        # Medium priority: Approaching deadline (≥80% of expected duration)
        days_in_stage = self._calculate_days_in_stage(job)
        expected_duration = EXPECTED_DURATION.get(job.status, 14)
        
        if days_in_stage >= (expected_duration * 0.8):
            return "medium"
        
        return "low"

    def _calculate_days_in_stage(self, job: Job) -> int:
        """Calculate days job has been in current stage."""
        # Use updated_at as proxy for stage change time
        return (_utcnow() - job.updated_at).days

    def _is_job_overdue(self, job: Job) -> bool:
        """Check if job exceeds expected duration for current stage."""
        expected_duration = EXPECTED_DURATION.get(job.status)
        if expected_duration is None:
            return False
        
        days_in_stage = self._calculate_days_in_stage(job)
        return days_in_stage > expected_duration

    def _get_last_activity_time(self, job: Job) -> str:
        """Get relative time of last activity."""
        if not job.activity_logs:
            return self._format_relative_time(job.updated_at)
        
        latest_activity = max(job.activity_logs, key=lambda a: a.created_at)
        return self._format_relative_time(latest_activity.created_at)


    async def _generate_alerts(self, active_jobs: list[Job]) -> list[AlertDTO]:
        """Generate alerts for items requiring attention."""
        alerts: list[AlertDTO] = []
        
        # Get additional alert sources
        overdue_payments = await self._repository.get_overdue_payments_with_job()
        stale_quotations = await self._repository.get_stale_quotations(days_threshold=14)
        
        # Alert: Overdue payments
        for payment in overdue_payments:
            days_overdue = 0
            if payment.due_date:
                days_overdue = (_utcnow().date() - payment.due_date).days
            
            severity = "critical" if days_overdue > 7 else "warning"
            
            alert = AlertDTO(
                id=str(uuid.uuid4()),
                type="payment_overdue",
                severity=severity,
                title="Payment Overdue",
                description=f"Payment for {payment.job.quotation.customer.full_name} is {days_overdue} days overdue",
                entity_id=str(payment.id),
                entity_type="payment",
                days_overdue=days_overdue,
            )
            alerts.append(alert)
        
        # Alert: Stale quotations
        for quotation in stale_quotations:
            days_waiting = (_utcnow() - quotation.updated_at).days
            severity = "critical" if days_waiting > 21 else "warning"
            
            alert = AlertDTO(
                id=str(uuid.uuid4()),
                type="quotation_waiting",
                severity=severity,
                title="Quotation Waiting for Response",
                description=f"Quotation {quotation.quotation_number} for {quotation.customer.full_name} waiting {days_waiting} days",
                entity_id=str(quotation.id),
                entity_type="quotation",
                days_overdue=days_waiting,
            )
            alerts.append(alert)
        
        # Alert: Jobs overdue for measurement
        for job in active_jobs:
            if job.status == JobStatus.MEASURING:
                days_in_stage = self._calculate_days_in_stage(job)
                if days_in_stage > 7:
                    alert = AlertDTO(
                        id=str(uuid.uuid4()),
                        type="measurement_overdue",
                        severity="critical",
                        title="Measurement Overdue",
                        description=f"Job for {job.quotation.customer.full_name} in measurement for {days_in_stage} days",
                        entity_id=str(job.id),
                        entity_type="job",
                        days_overdue=days_in_stage - 7,
                    )
                    alerts.append(alert)
        
        # Alert: Manufacturing delayed
        for job in active_jobs:
            if job.status == JobStatus.IN_PRODUCTION:
                days_in_stage = self._calculate_days_in_stage(job)
                if days_in_stage > 21:
                    severity = "critical" if days_in_stage > 30 else "warning"
                    alert = AlertDTO(
                        id=str(uuid.uuid4()),
                        type="manufacturing_delayed",
                        severity=severity,
                        title="Manufacturing Delayed",
                        description=f"Job for {job.quotation.customer.full_name} in production for {days_in_stage} days",
                        entity_id=str(job.id),
                        entity_type="job",
                        days_overdue=days_in_stage - 14,
                    )
                    alerts.append(alert)
        
        # Alert: Installation overdue
        for job in active_jobs:
            if job.status == JobStatus.READY_FOR_INSTALLATION:
                days_in_stage = self._calculate_days_in_stage(job)
                if days_in_stage > 10:
                    alert = AlertDTO(
                        id=str(uuid.uuid4()),
                        type="installation_overdue",
                        severity="critical",
                        title="Installation Overdue",
                        description=f"Job for {job.quotation.customer.full_name} ready for installation for {days_in_stage} days",
                        entity_id=str(job.id),
                        entity_type="job",
                        days_overdue=days_in_stage - 7,
                    )
                    alerts.append(alert)
        
        # Sort alerts: critical first, then by days overdue
        alerts.sort(
            key=lambda a: (
                0 if a.severity == "critical" else 1 if a.severity == "warning" else 2,
                -a.days_overdue,
            )
        )
        
        # Limit to top 100 alerts
        return alerts[:100]


    def _format_activities(self, activity_logs: list[ActivityLog]) -> list[ActivityDTO]:
        """Format activity logs with relative time."""
        activities: list[ActivityDTO] = []
        
        for log in activity_logs:
            try:
                customer_name = log.job.quotation.customer.full_name
            except AttributeError:
                customer_name = "Unknown Customer"
            
            activity = ActivityDTO(
                id=str(log.id),
                type=log.action,
                description=log.description or log.action,
                timestamp=log.created_at,
                relative_time=self._format_relative_time(log.created_at),
                entity_id=str(log.job_id),
                entity_type="job",
                customer_name=customer_name,
            )
            activities.append(activity)
        
        return activities

    def _format_relative_time(self, timestamp: datetime) -> str:
        """
        Format timestamp as relative time.
        
        Examples: "just now", "5 minutes ago", "2 hours ago", "3 days ago"
        """
        now = _utcnow()
        diff = now - timestamp
        
        seconds = diff.total_seconds()
        
        if seconds < 60:
            return "just now"
        
        minutes = int(seconds / 60)
        if minutes < 60:
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        
        hours = int(minutes / 60)
        if hours < 24:
            return f"{hours} hour{'s' if hours != 1 else ''} ago"
        
        days = diff.days
        if days < 7:
            return f"{days} day{'s' if days != 1 else ''} ago"
        
        # For older items, show date
        return timestamp.strftime("%b %d, %Y")
