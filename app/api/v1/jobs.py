"""Job API routes — production workflow."""
from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT
from app.core.query import Pagination, Sorting
from app.db.session import get_db
from app.enums.job import JobStatus
from app.repositories.job import JobFilters, JobRepository
from app.repositories.quotation import QuotationRepository
from app.schemas.errors import ErrorResponse
from app.schemas.job import (
    JobCreate,
    JobListResponse,
    JobRead,
    JobStatusUpdate,
    JobUpdate,
)
from app.services.job import JobService

router = APIRouter(tags=["jobs"])


def get_job_service(
    session: AsyncSession = Depends(get_db),
) -> JobService:
    """Wire job and quotation repositories."""
    return JobService(
        session,
        JobRepository(session),
        QuotationRepository(session),
    )


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------

@router.get(
    "/jobs",
    response_model=JobListResponse,
    summary="List jobs",
    description=(
        "Paginated job search. Filters: ``status``, ``customer`` (UUID), "
        "``quotation`` (UUID), ``date_from``, ``date_to``, ``workflow_stage``. "
        "Sort by: id, status, measurement_date, production_start, production_end, "
        "installation_date, delivery_date, completion_date, created_at, updated_at."
    ),
    responses={400: {"model": ErrorResponse}},
)
async def list_jobs(
    service: Annotated[JobService, Depends(get_job_service)],
    status_filter: Annotated[
        JobStatus | None,
        Query(alias="status", description="Filter by job status"),
    ] = None,
    customer: Annotated[
        uuid.UUID | None,
        Query(description="Filter by customer UUID"),
    ] = None,
    quotation: Annotated[
        uuid.UUID | None,
        Query(description="Filter by quotation UUID"),
    ] = None,
    workflow_stage: Annotated[
        str | None,
        Query(description="Filter by workflow stage (quotation, measurement, deposit_received, manufacturing, installation, completed, postponed, rejected)"),
    ] = None,
    date_from: Annotated[date | None, Query(description="Inclusive start date")] = None,
    date_to: Annotated[date | None, Query(description="Inclusive end date")] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_LIMIT)] = DEFAULT_PAGE_LIMIT,
    offset: Annotated[int, Query(ge=0)] = 0,
    sort_by: Annotated[str, Query()] = "created_at",
    sort_order: Annotated[Literal["asc", "desc"], Query()] = "desc",
) -> JobListResponse:
    pagination = Pagination(limit=limit, offset=offset)
    sorting = Sorting(sort_by=sort_by, sort_order=sort_order)
    filters = JobFilters(
        status=status_filter,
        customer_id=customer,
        quotation_id=quotation,
        date_from=date_from,
        date_to=date_to,
    )
    items, total = await service.list_jobs(
        pagination=pagination,
        sorting=sorting,
        filters=filters,
        workflow_stage=workflow_stage,
    )
    return JobListResponse(
        items=[JobRead.model_validate(i) for i in items],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.get(
    "/jobs/{job_id}",
    response_model=JobRead,
    summary="Get job by ID",
    description="Return a single job by UUID.",
    responses={404: {"model": ErrorResponse}},
)
async def get_job(
    job_id: uuid.UUID,
    service: Annotated[JobService, Depends(get_job_service)],
) -> JobRead:
    job = await service.get_job(job_id)
    return JobRead.model_validate(job)


@router.post(
    "/jobs",
    response_model=JobRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create job",
    description=(
        "Create a job from an approved quotation. "
        "**Business rules**:\n\n"
        "- Quotation must exist\n"
        "- Quotation must have status ``approved``\n"
        "- Only one job per quotation (duplicate check)\n\n"
        "Job starts in ``pending`` status. "
        "Activity log entry created automatically."
    ),
    responses={
        201: {"description": "Job created."},
        404: {"model": ErrorResponse, "description": "Quotation not found."},
        409: {"model": ErrorResponse, "description": "Job already exists for quotation."},
        422: {"model": ErrorResponse, "description": "Quotation not approved."},
    },
)
async def create_job(
    body: JobCreate,
    service: Annotated[JobService, Depends(get_job_service)],
) -> JobRead:
    job = await service.create_job(body.model_dump(exclude_none=True))
    return JobRead.model_validate(job)


@router.put(
    "/jobs/{job_id}",
    response_model=JobRead,
    summary="Update job",
    description=(
        "Update job dates and notes. Cannot update ``quotation_id`` or ``status`` "
        "(use ``PATCH /jobs/{id}/status`` for status changes). "
        "Terminal jobs (``completed`` or ``cancelled``) cannot be edited."
    ),
    responses={
        200: {"description": "Job updated."},
        404: {"model": ErrorResponse, "description": "Job not found."},
        422: {
            "model": ErrorResponse,
            "description": "Job in terminal status or business rule violation.",
        },
    },
)
async def update_job(
    job_id: uuid.UUID,
    body: JobUpdate,
    service: Annotated[JobService, Depends(get_job_service)],
) -> JobRead:
    job = await service.update_job(
        job_id,
        body.model_dump(exclude_unset=True),
    )
    return JobRead.model_validate(job)


@router.patch(
    "/jobs/{job_id}/status",
    response_model=JobRead,
    summary="Update job status",
    description=(
        "**Job lifecycle transitions**\n\n"
        "| From | To |\n"
        "|------|----|\n"
        "| `pending` | `measuring`, `cancelled` |\n"
        "| `measuring` | `in_production`, `cancelled` |\n"
        "| `in_production` | `ready_for_installation`, `cancelled` |\n"
        "| `ready_for_installation` | `installed`, `cancelled` |\n"
        "| `installed` | `completed`, `cancelled` |\n"
        "| `completed` / `cancelled` | *(terminal)* |\n\n"
        "**Auto-set dates**:\n"
        "- ``in_production`` → sets ``production_start`` if not set\n"
        "- ``completed`` → sets ``completion_date`` if not set\n\n"
        "Activity log entries created automatically."
    ),
    responses={
        200: {"description": "Status updated."},
        404: {"model": ErrorResponse},
        422: {"model": ErrorResponse, "description": "Invalid transition or terminal state."},
    },
)
async def update_job_status(
    job_id: uuid.UUID,
    body: JobStatusUpdate,
    service: Annotated[JobService, Depends(get_job_service)],
) -> JobRead:
    job = await service.update_status(job_id, body.status)
    return JobRead.model_validate(job)


@router.get(
    "/quotations/{quotation_id}/job",
    response_model=JobRead | None,
    summary="Get job by quotation",
    description="Return the job associated with a quotation (if any).",
    responses={200: {"description": "Job found or null."}},
)
async def get_quotation_job(
    quotation_id: uuid.UUID,
    service: Annotated[JobService, Depends(get_job_service)],
) -> JobRead | None:
    job = await service.get_job_by_quotation(quotation_id)
    return JobRead.model_validate(job) if job else None


@router.get(
    "/quotations/available-for-job",
    response_model=list[dict],
    summary="Get quotations available for job creation",
    description=(
        "Returns approved quotations that don't have a job yet. "
        "Each quotation includes customer details for easy selection."
    ),
)
async def get_available_quotations_for_job(
    service: Annotated[JobService, Depends(get_job_service)],
) -> list[dict]:
    """Get quotations that can be converted to jobs."""
    quotations = await service.get_available_quotations_for_job()
    return quotations


@router.get(
    "/customers/{customer_id}/jobs",
    response_model=JobListResponse,
    summary="List jobs for a customer",
    description="Paginated jobs belonging to one customer.",
    responses={404: {"model": ErrorResponse, "description": "Customer not found."}},
)
async def list_customer_jobs(
    customer_id: uuid.UUID,
    service: Annotated[JobService, Depends(get_job_service)],
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_LIMIT)] = DEFAULT_PAGE_LIMIT,
    offset: Annotated[int, Query(ge=0)] = 0,
    sort_by: Annotated[str, Query()] = "created_at",
    sort_order: Annotated[Literal["asc", "desc"], Query()] = "desc",
) -> JobListResponse:
    pagination = Pagination(limit=limit, offset=offset)
    sorting = Sorting(sort_by=sort_by, sort_order=sort_order)
    items, total = await service.list_customer_jobs(
        customer_id,
        pagination=pagination,
        sorting=sorting,
    )
    return JobListResponse(
        items=[JobRead.model_validate(i) for i in items],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )
