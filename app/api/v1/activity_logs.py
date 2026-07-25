"""
Activity Logs API endpoints.
"""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.activity_log import ActivityLog
from app.schemas.activity_log import ActivityLogRead, ActivityLogListResponse

router = APIRouter(prefix="/activity-logs", tags=["Activity Logs"])


@router.get(
    "",
    response_model=ActivityLogListResponse,
    summary="List activity logs",
    description=(
        "Retrieve activity logs with optional filters.\n\n"
        "**Query Parameters**:\n"
        "- job_id: Filter by job\n"
        "- limit/offset: Pagination\n\n"
        "**Ordering**: Most recent first (created_at DESC)"
    ),
)
async def list_activity_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    job_id: Annotated[UUID | None, Query(description="Filter by job ID")] = None,
    limit: Annotated[int, Query(ge=1, le=200, description="Max items")] = 100,
    offset: Annotated[int, Query(ge=0, description="Skip items")] = 0,
):
    """List activity logs with optional filters."""
    stmt = select(ActivityLog)
    
    if job_id:
        stmt = stmt.where(ActivityLog.job_id == job_id)
    
    # Count total
    from sqlalchemy import func
    count_stmt = select(func.count()).select_from(stmt.subquery())
    count_result = await db.execute(count_stmt)
    total = count_result.scalar_one()
    
    # Get items
    stmt = stmt.order_by(ActivityLog.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()
    
    return ActivityLogListResponse(
        items=[ActivityLogRead.model_validate(i) for i in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{activity_log_id}",
    response_model=ActivityLogRead,
    summary="Get activity log",
    description="Retrieve a single activity log entry by ID.",
)
async def get_activity_log(
    activity_log_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get activity log by ID."""
    from app.core.exceptions import EntityNotFoundError
    
    stmt = select(ActivityLog).where(ActivityLog.id == activity_log_id)
    result = await db.execute(stmt)
    log = result.scalar_one_or_none()
    
    if not log:
        raise EntityNotFoundError(f"Activity log {activity_log_id} not found")
    
    return ActivityLogRead.model_validate(log)
