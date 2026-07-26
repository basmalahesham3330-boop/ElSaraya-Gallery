"""API tests for the Job module."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


async def _seed_approved_quotation(client: AsyncClient) -> dict:
    """Create customer, product, quotation with items, and approve it."""
    # Use unique names to avoid conflicts in tests that call this multiple times
    unique_suffix = uuid.uuid4().hex[:8]
    
    # Create customer
    customer = (
        await client.post(
            "/api/v1/customers",
            json={
                "full_name": f"Job Test Customer {unique_suffix}",
                "phone_number": f"0105555{unique_suffix[:4]}",
            },
        )
    ).json()
    
    # Create category and product
    category = (
        await client.post(
            "/api/v1/product-categories",
            json={"name": f"Kitchen Cabinets {unique_suffix}"},
        )
    ).json()
    product = (
        await client.post(
            "/api/v1/products",
            json={
                "category_id": category["id"],
                "name": f"Modular Kitchen {unique_suffix}",
                "active": True,
            },
        )
    ).json()
    
    # Create quotation
    quotation = (
        await client.post(
            "/api/v1/quotations",
            json={
                "customer_id": customer["id"],
                "discount": "0.00",
            },
        )
    ).json()
    
    # Add item
    await client.post(
        f"/api/v1/quotations/{quotation['id']}/items",
        json={
            "product_id": product["id"],
            "quantity": 1,
            "unit_price": "25000.00",
        },
    )
    
    # Transition to approved via workflow
    # draft -> waiting_for_measurement
    await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "waiting_for_measurement"},
    )
    # waiting_for_measurement -> measured
    await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "measured"},
    )
    # measured -> sent
    await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "sent"},
    )
    # sent -> approved
    response = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "approved"},
    )
    approval_response = response.json()
    
    return {
        "customer": customer,
        "category": category,
        "product": product,
        "quotation": approval_response["quotation"],
        "job": approval_response["job"],  # Job is created automatically
    }


@pytest.mark.asyncio
async def test_create_job_from_approved_quotation(client: AsyncClient) -> None:
    """Test that job is created automatically when quotation is approved."""
    seed = await _seed_approved_quotation(client)
    
    # Job should be created automatically
    assert seed["job"] is not None
    assert seed["job"]["id"] is not None
    assert seed["job"]["quotation_id"] == seed["quotation"]["id"]
    assert seed["job"]["status"] == "pending"
    
    # Verify job is accessible via GET
    response = await client.get(f"/api/v1/jobs/{seed['job']['id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == seed["job"]["id"]
    assert data["quotation_id"] == seed["quotation"]["id"]
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_create_job_from_non_approved_quotation_fails(client: AsyncClient) -> None:
    """Test that creating a job from non-approved quotation fails."""
    # Create draft quotation
    customer = (
        await client.post(
            "/api/v1/customers",
            json={"full_name": "Test Customer", "phone_number": "01011112222"},
        )
    ).json()
    quotation = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": customer["id"]},
        )
    ).json()
    
    # Try to create job
    response = await client.post(
        "/api/v1/jobs",
        json={"quotation_id": quotation["id"]},
    )
    
    assert response.status_code == 422
    assert "approved" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_duplicate_job_for_quotation_fails(client: AsyncClient) -> None:
    """Test that only one job exists per quotation (created automatically)."""
    seed = await _seed_approved_quotation(client)
    
    # Job already exists (created automatically)
    assert seed["job"] is not None
    
    # Try to create another job manually should fail
    response = await client.post(
        "/api/v1/jobs",
        json={"quotation_id": seed["quotation"]["id"]},
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_job_by_id(client: AsyncClient) -> None:
    """Test retrieving a job by ID."""
    seed = await _seed_approved_quotation(client)
    job = seed["job"]  # Job created automatically
    
    response = await client.get(f"/api/v1/jobs/{job['id']}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == job["id"]
    assert data["quotation_id"] == seed["quotation"]["id"]
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_get_job_by_quotation(client: AsyncClient) -> None:
    """Test retrieving job by quotation ID."""
    seed = await _seed_approved_quotation(client)
    job = seed["job"]  # Job created automatically
    
    response = await client.get(f"/api/v1/quotations/{seed['quotation']['id']}/job")
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == job["id"]
    assert data["quotation_id"] == seed["quotation"]["id"]


@pytest.mark.asyncio
async def test_get_job_by_quotation_returns_null_when_none(client: AsyncClient) -> None:
    """Test that quotation without approval has no job yet."""
    # Create draft quotation (not approved)
    unique_suffix = uuid.uuid4().hex[:8]
    customer = (
        await client.post(
            "/api/v1/customers",
            json={"full_name": f"Test Customer {unique_suffix}", "phone_number": f"0101111{unique_suffix[:4]}"},
        )
    ).json()
    quotation = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": customer["id"]},
        )
    ).json()
    
    # Draft quotation has no job
    response = await client.get(f"/api/v1/quotations/{quotation['id']}/job")
    
    assert response.status_code == 200
    assert response.json() is None


@pytest.mark.asyncio
async def test_update_job_dates(client: AsyncClient) -> None:
    """Test updating job dates and notes."""
    seed = await _seed_approved_quotation(client)
    job = seed["job"]  # Job created automatically
    
    response = await client.put(
        f"/api/v1/jobs/{job['id']}",
        json={
            "measurement_date": "2026-01-15",
            "production_start": "2026-01-20",
            "installation_date": "2026-02-01",
            "notes": "Updated notes",
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["measurement_date"] == "2026-01-15"
    assert data["production_start"] == "2026-01-20"
    assert data["installation_date"] == "2026-02-01"
    assert data["notes"] == "Updated notes"


@pytest.mark.asyncio
async def test_update_job_status_workflow(client: AsyncClient) -> None:
    """Test complete job status workflow."""
    seed = await _seed_approved_quotation(client)
    job = seed["job"]  # Job created automatically
    
    # pending -> measuring
    response = await client.patch(
        f"/api/v1/jobs/{job['id']}/status",
        json={"status": "measuring"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "measuring"
    
    # measuring -> in_production
    response = await client.patch(
        f"/api/v1/jobs/{job['id']}/status",
        json={"status": "in_production"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "in_production"
    assert data["production_start"] is not None  # Auto-set
    
    # in_production -> ready_for_installation
    response = await client.patch(
        f"/api/v1/jobs/{job['id']}/status",
        json={"status": "ready_for_installation"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ready_for_installation"
    
    # ready_for_installation -> installed
    response = await client.patch(
        f"/api/v1/jobs/{job['id']}/status",
        json={"status": "installed"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "installed"
    
    # installed -> completed
    response = await client.patch(
        f"/api/v1/jobs/{job['id']}/status",
        json={"status": "completed"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["completion_date"] is not None  # Auto-set


@pytest.mark.asyncio
async def test_invalid_status_transition_fails(client: AsyncClient) -> None:
    """Test that invalid status transitions are rejected."""
    seed = await _seed_approved_quotation(client)
    job = seed["job"]  # Job created automatically
    
    # Try to jump from pending to completed (invalid)
    response = await client.patch(
        f"/api/v1/jobs/{job['id']}/status",
        json={"status": "completed"},
    )
    
    assert response.status_code == 422
    assert "invalid" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_terminal_status_cannot_be_changed(client: AsyncClient) -> None:
    """Test that terminal statuses cannot be changed."""
    seed = await _seed_approved_quotation(client)
    job = seed["job"]  # Job created automatically
    
    # Cancel job
    await client.patch(
        f"/api/v1/jobs/{job['id']}/status",
        json={"status": "cancelled"},
    )
    
    # Try to change from cancelled
    response = await client.patch(
        f"/api/v1/jobs/{job['id']}/status",
        json={"status": "pending"},
    )
    
    assert response.status_code == 422
    assert "terminal" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_terminal_job_cannot_be_edited(client: AsyncClient) -> None:
    """Test that terminal jobs cannot be edited."""
    seed = await _seed_approved_quotation(client)
    job = seed["job"]  # Job created automatically
    
    # Cancel job
    await client.patch(
        f"/api/v1/jobs/{job['id']}/status",
        json={"status": "cancelled"},
    )
    
    # Try to edit
    response = await client.put(
        f"/api/v1/jobs/{job['id']}",
        json={"notes": "Trying to update cancelled job"},
    )
    
    assert response.status_code == 422
    assert "terminal" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_list_jobs(client: AsyncClient) -> None:
    """Test listing jobs with pagination."""
    seed1 = await _seed_approved_quotation(client)
    seed2 = await _seed_approved_quotation(client)
    
    await client.post("/api/v1/jobs", json={"quotation_id": seed1["quotation"]["id"]})
    await client.post("/api/v1/jobs", json={"quotation_id": seed2["quotation"]["id"]})
    
    response = await client.get("/api/v1/jobs")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2
    assert len(data["items"]) >= 2
    assert "limit" in data
    assert "offset" in data


@pytest.mark.asyncio
async def test_filter_jobs_by_status(client: AsyncClient) -> None:
    """Test filtering jobs by status."""
    seed = await _seed_approved_quotation(client)
    job = seed["job"]  # Job created automatically
    
    # Change to measuring
    await client.patch(
        f"/api/v1/jobs/{job['id']}/status",
        json={"status": "measuring"},
    )
    
    # Filter by measuring status
    response = await client.get("/api/v1/jobs?status=measuring")
    
    assert response.status_code == 200
    data = response.json()
    assert all(item["status"] == "measuring" for item in data["items"])


@pytest.mark.asyncio
async def test_list_customer_jobs(client: AsyncClient) -> None:
    """Test listing jobs for a specific customer."""
    seed = await _seed_approved_quotation(client)
    await client.post("/api/v1/jobs", json={"quotation_id": seed["quotation"]["id"]})
    
    response = await client.get(f"/api/v1/customers/{seed['customer']['id']}/jobs")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    # All jobs should be for this customer's quotations
    assert all(item["quotation_id"] for item in data["items"])


@pytest.mark.asyncio
async def test_job_cancellation_from_any_non_terminal_state(client: AsyncClient) -> None:
    """Test that jobs can be cancelled from any non-terminal status."""
    seed = await _seed_approved_quotation(client)
    job = seed["job"]  # Job created automatically
    
    # Move to measuring
    await client.patch(
        f"/api/v1/jobs/{job['id']}/status",
        json={"status": "measuring"},
    )
    
    # Cancel from measuring
    response = await client.patch(
        f"/api/v1/jobs/{job['id']}/status",
        json={"status": "cancelled"},
    )
    
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_job_not_found(client: AsyncClient) -> None:
    """Test 404 for non-existent job."""
    import uuid
    fake_id = str(uuid.uuid4())
    
    response = await client.get(f"/api/v1/jobs/{fake_id}")
    
    assert response.status_code == 404
