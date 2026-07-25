"""Health check endpoint."""
from fastapi import APIRouter, Request

from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Simple liveness check used by Docker/orchestrators and load balancers."""
    return HealthResponse(status="ok")


@router.get("/debug/routes")
async def debug_routes(request: Request) -> dict:
    """Debug endpoint to show all registered routes."""
    routes = []
    for route in request.app.routes:
        routes.append({
            "path": route.path,
            "methods": list(getattr(route, "methods", [])),
        })
    return {
        "total": len(routes),
        "routes": sorted(routes, key=lambda x: x["path"]),
    }
