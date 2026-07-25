"""
Aggregated v1 API router.

Add new feature routers here as the application grows.
"""
from fastapi import APIRouter

from app.api.v1 import (
    activity_logs,
    customers,
    dashboard,
    health,
    jobs,
    measurements,
    payments,
    product_categories,
    products,
    quotations,
)
from app.core.config import settings

router = APIRouter(prefix=settings.API_V1_PREFIX)

router.include_router(health.router)
router.include_router(dashboard.router)
router.include_router(customers.router)
router.include_router(product_categories.router)
router.include_router(products.router)
router.include_router(quotations.router)
router.include_router(jobs.router)
router.include_router(measurements.router)
router.include_router(payments.router)
router.include_router(activity_logs.router)
