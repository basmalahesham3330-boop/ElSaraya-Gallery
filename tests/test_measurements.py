"""API tests for the Measurement module."""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


async def _seed_job_with_quotation(client: AsyncClient) -> dict:
    """Create customer, product, quotation, approve it, and create job."""
    unique_suffix = uuid.uuid4().hex[:8]
    # Generate unique 11-digit phone number
    unique_num = str(abs(hash(unique_suffix)))[:8]

    # Create customer with fully unique phone number
    customer = (
        await client.post(
            "/api/v1/customers",
            json={
                "full_name": f"Measurement Test Customer {unique_suffix}",
                "phone_number": f"010{unique_num}",
            },
        )
    ).json()

    # Create category and product
    category = (
        await client.post(
            "/api/v1/product-categories",
            json={"name": f"Cabinets {unique_suffix}"},
        )
    ).json()
    product = (
        await client.post(
            "/api/v1/products",
            json={
                "category_id": category["id"],
                "name": f"Kitchen Cabinet {unique_suffix}",
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

    # Add item to quotation
    quotation_item = (
        await client.post(
            f"/api/v1/quotations/{quotation['id']}/items",
            json={
                "product_id": product["id"],
                "quantity": 1,
                "unit_price": "15000.00",
            },
        )
    ).json()

    # Approve quotation (workflow: draft -> waiting -> measured -> sent -> approved)
    await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "waiting_for_measurement"},
    )
    await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "measured"},
    )
    await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "sent"},
    )
    response = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "approved"},
    )
    approval_response = response.json()

    # Job is created automatically when quotation is approved
    job = approval_response["job"]
    approved_quotation = approval_response["quotation"]

    return {
        "customer": customer,
        "product": product,
        "quotation": approved_quotation,
        "quotation_item": quotation_item,
        "job": job,
    }


# ------------------------------------------------------------------
# Measurement tests
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_measurement_for_job(client: AsyncClient) -> None:
    """Test creating a measurement for a job."""
    seed = await _seed_job_with_quotation(client)

    response = await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/measurements",
        json={
            "visit_date": "2026-07-25",
            "measured_by": "Ahmed Hassan",
            "notes": "First visit - kitchen area",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["job_id"] == seed["job"]["id"]
    assert data["measurement_number"] == 1
    assert data["visit_date"] == "2026-07-25"
    assert data["measured_by"] == "Ahmed Hassan"
    assert data["notes"] == "First visit - kitchen area"


@pytest.mark.asyncio
async def test_measurement_number_auto_increments(client: AsyncClient) -> None:
    """Test that measurement_number auto-increments."""
    seed = await _seed_job_with_quotation(client)

    # Create first measurement
    m1 = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/measurements",
            json={"visit_date": "2026-07-25"},
        )
    ).json()
    assert m1["measurement_number"] == 1

    # Create second measurement
    m2 = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/measurements",
            json={"visit_date": "2026-07-26"},
        )
    ).json()
    assert m2["measurement_number"] == 2

    # Create third measurement
    m3 = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/measurements",
            json={"visit_date": "2026-07-27"},
        )
    ).json()
    assert m3["measurement_number"] == 3


@pytest.mark.asyncio
async def test_get_measurement_by_id(client: AsyncClient) -> None:
    """Test retrieving a measurement by ID."""
    seed = await _seed_job_with_quotation(client)
    measurement = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/measurements",
            json={"visit_date": "2026-07-25", "measured_by": "Test User"},
        )
    ).json()

    response = await client.get(f"/api/v1/measurements/{measurement['id']}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == measurement["id"]
    assert data["measurement_number"] == 1
    assert data["measured_by"] == "Test User"


@pytest.mark.asyncio
async def test_update_measurement(client: AsyncClient) -> None:
    """Test updating measurement details."""
    seed = await _seed_job_with_quotation(client)
    measurement = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/measurements",
            json={"visit_date": "2026-07-25"},
        )
    ).json()

    response = await client.put(
        f"/api/v1/measurements/{measurement['id']}",
        json={
            "visit_date": "2026-07-26",
            "measured_by": "Updated User",
            "notes": "Updated notes",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["visit_date"] == "2026-07-26"
    assert data["measured_by"] == "Updated User"
    assert data["notes"] == "Updated notes"


@pytest.mark.asyncio
async def test_list_job_measurements(client: AsyncClient) -> None:
    """Test listing measurements for a job."""
    seed = await _seed_job_with_quotation(client)

    # Create multiple measurements
    await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/measurements",
        json={"visit_date": "2026-07-25"},
    )
    await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/measurements",
        json={"visit_date": "2026-07-26"},
    )

    response = await client.get(f"/api/v1/jobs/{seed['job']['id']}/measurements")

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    # Default sort is measurement_number desc
    assert data["items"][0]["measurement_number"] == 2
    assert data["items"][1]["measurement_number"] == 1


@pytest.mark.asyncio
async def test_create_measurement_for_nonexistent_job_fails(client: AsyncClient) -> None:
    """Test that creating measurement for nonexistent job fails."""
    fake_job_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        f"/api/v1/jobs/{fake_job_id}/measurements",
        json={"visit_date": "2026-07-25"},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_measurement_not_found(client: AsyncClient) -> None:
    """Test 404 for nonexistent measurement."""
    fake_id = "00000000-0000-0000-0000-000000000000"

    response = await client.get(f"/api/v1/measurements/{fake_id}")

    assert response.status_code == 404


# ------------------------------------------------------------------
# Measurement Item tests
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_measurement_item(client: AsyncClient) -> None:
    """Test adding an item to a measurement."""
    seed = await _seed_job_with_quotation(client)
    measurement = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/measurements",
            json={"visit_date": "2026-07-25"},
        )
    ).json()

    response = await client.post(
        f"/api/v1/measurements/{measurement['id']}/items",
        json={
            "quotation_item_id": seed["quotation_item"]["id"],
            "room_name": "Kitchen",
            "piece_number": "K-001",
            "width": "250.50",
            "height": "180.75",
            "quantity": 2,
            "notes": "Corner cabinet",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["measurement_id"] == measurement["id"]
    assert data["quotation_item_id"] == seed["quotation_item"]["id"]
    assert data["room_name"] == "Kitchen"
    assert data["piece_number"] == "K-001"
    assert data["width"] == "250.50"
    assert data["height"] == "180.75"
    assert data["quantity"] == 2
    assert data["notes"] == "Corner cabinet"


@pytest.mark.asyncio
async def test_add_measurement_item_with_quotation_from_different_job_fails(
    client: AsyncClient,
) -> None:
    """Test that adding item from different job's quotation fails."""
    # Create first job with quotation
    seed1 = await _seed_job_with_quotation(client)
    
    # Create second job with different quotation
    seed2 = await _seed_job_with_quotation(client)

    # Create measurement for job1
    measurement = (
        await client.post(
            f"/api/v1/jobs/{seed1['job']['id']}/measurements",
            json={"visit_date": "2026-07-25"},
        )
    ).json()

    # Try to add item from job2's quotation to job1's measurement
    response = await client.post(
        f"/api/v1/measurements/{measurement['id']}/items",
        json={
            "quotation_item_id": seed2["quotation_item"]["id"],
            "quantity": 1,
        },
    )

    assert response.status_code == 422
    assert "same quotation" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_list_measurement_items(client: AsyncClient) -> None:
    """Test listing items for a measurement."""
    seed = await _seed_job_with_quotation(client)
    measurement = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/measurements",
            json={"visit_date": "2026-07-25"},
        )
    ).json()

    # Add two items
    await client.post(
        f"/api/v1/measurements/{measurement['id']}/items",
        json={
            "quotation_item_id": seed["quotation_item"]["id"],
            "room_name": "Kitchen",
            "quantity": 1,
        },
    )
    await client.post(
        f"/api/v1/measurements/{measurement['id']}/items",
        json={
            "quotation_item_id": seed["quotation_item"]["id"],
            "room_name": "Living Room",
            "quantity": 1,
        },
    )

    response = await client.get(f"/api/v1/measurements/{measurement['id']}/items")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_update_measurement_item(client: AsyncClient) -> None:
    """Test updating a measurement item."""
    seed = await _seed_job_with_quotation(client)
    measurement = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/measurements",
            json={"visit_date": "2026-07-25"},
        )
    ).json()
    item = (
        await client.post(
            f"/api/v1/measurements/{measurement['id']}/items",
            json={
                "quotation_item_id": seed["quotation_item"]["id"],
                "room_name": "Kitchen",
                "width": "200.00",
                "height": "150.00",
                "quantity": 1,
            },
        )
    ).json()

    response = await client.put(
        f"/api/v1/measurement-items/{item['id']}",
        json={
            "room_name": "Updated Kitchen",
            "width": "220.50",
            "height": "160.25",
            "quantity": 2,
            "notes": "Adjusted measurements",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["room_name"] == "Updated Kitchen"
    assert data["width"] == "220.50"
    assert data["height"] == "160.25"
    assert data["quantity"] == 2
    assert data["notes"] == "Adjusted measurements"


@pytest.mark.asyncio
async def test_negative_width_rejected(client: AsyncClient) -> None:
    """Test that negative width is rejected."""
    seed = await _seed_job_with_quotation(client)
    measurement = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/measurements",
            json={"visit_date": "2026-07-25"},
        )
    ).json()

    response = await client.post(
        f"/api/v1/measurements/{measurement['id']}/items",
        json={
            "quotation_item_id": seed["quotation_item"]["id"],
            "width": "-10.00",
            "quantity": 1,
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_negative_height_rejected(client: AsyncClient) -> None:
    """Test that negative height is rejected."""
    seed = await _seed_job_with_quotation(client)
    measurement = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/measurements",
            json={"visit_date": "2026-07-25"},
        )
    ).json()

    response = await client.post(
        f"/api/v1/measurements/{measurement['id']}/items",
        json={
            "quotation_item_id": seed["quotation_item"]["id"],
            "height": "-5.00",
            "quantity": 1,
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_zero_quantity_rejected(client: AsyncClient) -> None:
    """Test that zero quantity is rejected."""
    seed = await _seed_job_with_quotation(client)
    measurement = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/measurements",
            json={"visit_date": "2026-07-25"},
        )
    ).json()

    response = await client.post(
        f"/api/v1/measurements/{measurement['id']}/items",
        json={
            "quotation_item_id": seed["quotation_item"]["id"],
            "quantity": 0,
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_negative_quantity_rejected(client: AsyncClient) -> None:
    """Test that negative quantity is rejected."""
    seed = await _seed_job_with_quotation(client)
    measurement = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/measurements",
            json={"visit_date": "2026-07-25"},
        )
    ).json()

    response = await client.post(
        f"/api/v1/measurements/{measurement['id']}/items",
        json={
            "quotation_item_id": seed["quotation_item"]["id"],
            "quantity": -1,
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_missing_quotation_item_rejected(client: AsyncClient) -> None:
    """Test that missing quotation_item_id is rejected."""
    seed = await _seed_job_with_quotation(client)
    measurement = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/measurements",
            json={"visit_date": "2026-07-25"},
        )
    ).json()

    response = await client.post(
        f"/api/v1/measurements/{measurement['id']}/items",
        json={"quantity": 1},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_nonexistent_quotation_item_rejected(client: AsyncClient) -> None:
    """Test that nonexistent quotation item is rejected."""
    seed = await _seed_job_with_quotation(client)
    measurement = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/measurements",
            json={"visit_date": "2026-07-25"},
        )
    ).json()

    fake_item_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        f"/api/v1/measurements/{measurement['id']}/items",
        json={
            "quotation_item_id": fake_item_id,
            "quantity": 1,
        },
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_measurement_item_not_found(client: AsyncClient) -> None:
    """Test 404 for nonexistent measurement item."""
    fake_id = "00000000-0000-0000-0000-000000000000"

    response = await client.put(
        f"/api/v1/measurement-items/{fake_id}",
        json={"quantity": 2},
    )

    assert response.status_code == 404

