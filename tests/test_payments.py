"""API tests for the Payment module."""
from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient


async def _seed_job(client: AsyncClient) -> dict:
    """Create customer, product, quotation with items, approve it, and create job."""
    # Use unique names to avoid conflicts
    unique_suffix = uuid.uuid4().hex[:8]
    
    # Create customer
    customer = (
        await client.post(
            "/api/v1/customers",
            json={
                "full_name": f"Payment Test Customer {unique_suffix}",
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
            "unit_price": "50000.00",
        },
    )
    
    # Transition to approved via workflow
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
        "category": category,
        "product": product,
        "quotation": approved_quotation,
        "job": job,
    }


@pytest.mark.asyncio
async def test_create_payment(client: AsyncClient) -> None:
    """Test creating a payment for a job."""
    seed = await _seed_job(client)
    
    today = date.today()
    due = today + timedelta(days=7)
    
    response = await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "deposit",
            "payment_method": "bank_transfer",
            "percentage": "70.00",
            "amount": "35000.00",
            "due_date": due.isoformat(),
            "notes": "70% deposit payment",
        },
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["job_id"] == seed["job"]["id"]
    assert data["payment_order"] == 1
    assert data["payment_type"] == "deposit"
    assert data["payment_method"] == "bank_transfer"
    assert data["percentage"] == "70.00"
    assert data["amount"] == "35000.00"
    assert data["status"] == "pending"
    assert data["notes"] == "70% deposit payment"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_payment_with_paid_date(client: AsyncClient) -> None:
    """Test creating a payment with paid_date sets status to paid."""
    seed = await _seed_job(client)
    
    today = date.today()
    
    response = await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "deposit",
            "payment_method": "cash",
            "percentage": "70.00",
            "amount": "35000.00",
            "due_date": today.isoformat(),
            "paid_date": today.isoformat(),
        },
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "paid"
    assert data["paid_date"] == today.isoformat()


@pytest.mark.asyncio
async def test_payment_order_auto_increment(client: AsyncClient) -> None:
    """Test that payment_order auto-increments per job."""
    seed = await _seed_job(client)
    
    # Create first payment
    response1 = await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "deposit",
            "payment_method": "cash",
            "percentage": "70.00",
            "amount": "35000.00",
        },
    )
    assert response1.status_code == 201
    assert response1.json()["payment_order"] == 1
    
    # Create second payment
    response2 = await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "production",
            "payment_method": "bank_transfer",
            "percentage": "20.00",
            "amount": "10000.00",
        },
    )
    assert response2.status_code == 201
    assert response2.json()["payment_order"] == 2
    
    # Create third payment
    response3 = await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "final",
            "payment_method": "instapay",
            "percentage": "10.00",
            "amount": "5000.00",
        },
    )
    assert response3.status_code == 201
    assert response3.json()["payment_order"] == 3


@pytest.mark.asyncio
async def test_create_payment_invalid_percentage(client: AsyncClient) -> None:
    """Test that invalid percentage is rejected."""
    seed = await _seed_job(client)
    
    # Test percentage = 0
    response1 = await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "deposit",
            "payment_method": "cash",
            "percentage": "0.00",
            "amount": "0.00",
        },
    )
    assert response1.status_code == 422
    
    # Test percentage > 100
    response2 = await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "deposit",
            "payment_method": "cash",
            "percentage": "101.00",
            "amount": "50000.00",
        },
    )
    assert response2.status_code == 422
    
    # Test negative percentage
    response3 = await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "deposit",
            "payment_method": "cash",
            "percentage": "-10.00",
            "amount": "50000.00",
        },
    )
    assert response3.status_code == 422


@pytest.mark.asyncio
async def test_create_payment_negative_amount(client: AsyncClient) -> None:
    """Test that negative amount is rejected."""
    seed = await _seed_job(client)
    
    response = await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "deposit",
            "payment_method": "cash",
            "percentage": "50.00",
            "amount": "-1000.00",
        },
    )
    
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_payment_paid_date_before_due_date(client: AsyncClient) -> None:
    """Test that paid_date before due_date is rejected."""
    seed = await _seed_job(client)
    
    today = date.today()
    due = today + timedelta(days=7)
    paid = due - timedelta(days=1)  # One day before due date, but still after today
    
    response = await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "deposit",
            "payment_method": "cash",
            "percentage": "70.00",
            "amount": "35000.00",
            "due_date": due.isoformat(),
            "paid_date": paid.isoformat(),
        },
    )
    
    # Validation can return either 400 (Pydantic) or 422 (service)
    assert response.status_code in (400, 422)
    detail = str(response.json().get("detail", "")).lower()
    assert "paid_date" in detail or "due_date" in detail or "date" in detail


@pytest.mark.asyncio
async def test_create_payment_nonexistent_job(client: AsyncClient) -> None:
    """Test that creating payment for non-existent job fails."""
    fake_job_id = str(uuid.uuid4())
    
    response = await client.post(
        f"/api/v1/jobs/{fake_job_id}/payments",
        json={
            "job_id": fake_job_id,
            "payment_type": "deposit",
            "payment_method": "cash",
            "percentage": "70.00",
            "amount": "35000.00",
        },
    )
    
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_payment_by_id(client: AsyncClient) -> None:
    """Test retrieving a payment by ID."""
    seed = await _seed_job(client)
    payment = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/payments",
            json={
                "job_id": seed["job"]["id"],
                "payment_type": "deposit",
                "payment_method": "cash",
                "percentage": "70.00",
                "amount": "35000.00",
            },
        )
    ).json()
    
    response = await client.get(f"/api/v1/payments/{payment['id']}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == payment["id"]
    assert data["job_id"] == seed["job"]["id"]
    assert data["payment_type"] == "deposit"


@pytest.mark.asyncio
async def test_list_job_payments(client: AsyncClient) -> None:
    """Test listing all payments for a job."""
    seed = await _seed_job(client)
    
    # Create multiple payments
    await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "deposit",
            "payment_method": "cash",
            "percentage": "70.00",
            "amount": "35000.00",
        },
    )
    await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "production",
            "payment_method": "bank_transfer",
            "percentage": "20.00",
            "amount": "10000.00",
        },
    )
    
    response = await client.get(f"/api/v1/jobs/{seed['job']['id']}/payments")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    # Default sort by payment_order ascending
    assert data["items"][0]["payment_order"] == 1
    assert data["items"][1]["payment_order"] == 2


@pytest.mark.asyncio
async def test_update_payment(client: AsyncClient) -> None:
    """Test updating payment details."""
    seed = await _seed_job(client)
    payment = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/payments",
            json={
                "job_id": seed["job"]["id"],
                "payment_type": "deposit",
                "payment_method": "cash",
                "percentage": "70.00",
                "amount": "35000.00",
            },
        )
    ).json()
    
    today = date.today()
    response = await client.put(
        f"/api/v1/payments/{payment['id']}",
        json={
            "payment_method": "bank_transfer",
            "amount": "36000.00",
            "due_date": today.isoformat(),
            "notes": "Updated payment details",
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["payment_method"] == "bank_transfer"
    assert data["amount"] == "36000.00"
    assert data["due_date"] == today.isoformat()
    assert data["notes"] == "Updated payment details"


@pytest.mark.asyncio
async def test_update_payment_status_to_paid(client: AsyncClient) -> None:
    """Test updating payment status to paid."""
    seed = await _seed_job(client)
    payment = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/payments",
            json={
                "job_id": seed["job"]["id"],
                "payment_type": "deposit",
                "payment_method": "cash",
                "percentage": "70.00",
                "amount": "35000.00",
            },
        )
    ).json()
    
    response = await client.patch(
        f"/api/v1/payments/{payment['id']}/status",
        json={"status": "paid"},
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "paid"
    assert data["paid_date"] is not None  # Auto-set


@pytest.mark.asyncio
async def test_terminal_payment_cannot_change_status(client: AsyncClient) -> None:
    """Test that terminal payment statuses cannot be changed."""
    seed = await _seed_job(client)
    payment = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/payments",
            json={
                "job_id": seed["job"]["id"],
                "payment_type": "deposit",
                "payment_method": "cash",
                "percentage": "70.00",
                "amount": "35000.00",
            },
        )
    ).json()
    
    # Mark as paid
    await client.patch(
        f"/api/v1/payments/{payment['id']}/status",
        json={"status": "paid"},
    )
    
    # Try to change from paid (terminal)
    response = await client.patch(
        f"/api/v1/payments/{payment['id']}/status",
        json={"status": "pending"},
    )
    
    assert response.status_code == 422
    assert "terminal" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_payment_not_found(client: AsyncClient) -> None:
    """Test 404 for non-existent payment."""
    fake_id = str(uuid.uuid4())
    
    response = await client.get(f"/api/v1/payments/{fake_id}")
    
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_flexible_payment_workflow(client: AsyncClient) -> None:
    """Test that the system supports flexible payment workflows (not hardcoded)."""
    seed = await _seed_job(client)
    
    # Create custom payment workflow (not the default 70/20/10)
    # Payment 1: 40%
    response1 = await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "deposit",
            "payment_method": "cash",
            "percentage": "40.00",
            "amount": "20000.00",
        },
    )
    assert response1.status_code == 201
    
    # Payment 2: 30%
    response2 = await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "production",
            "payment_method": "bank_transfer",
            "percentage": "30.00",
            "amount": "15000.00",
        },
    )
    assert response2.status_code == 201
    
    # Payment 3: 30%
    response3 = await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "final",
            "payment_method": "instapay",
            "percentage": "30.00",
            "amount": "15000.00",
        },
    )
    assert response3.status_code == 201
    
    # All payments should be created successfully
    payments = (
        await client.get(f"/api/v1/jobs/{seed['job']['id']}/payments")
    ).json()
    assert payments["total"] == 3


@pytest.mark.asyncio
async def test_payment_sorting(client: AsyncClient) -> None:
    """Test sorting payments."""
    seed = await _seed_job(client)
    
    # Create payments with different amounts
    await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "deposit",
            "payment_method": "cash",
            "percentage": "70.00",
            "amount": "35000.00",
        },
    )
    await client.post(
        f"/api/v1/jobs/{seed['job']['id']}/payments",
        json={
            "job_id": seed["job"]["id"],
            "payment_type": "production",
            "payment_method": "bank_transfer",
            "percentage": "20.00",
            "amount": "10000.00",
        },
    )
    
    # Sort by amount descending
    response = await client.get(
        f"/api/v1/jobs/{seed['job']['id']}/payments?sort_by=amount&sort_order=desc"
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert float(data["items"][0]["amount"]) > float(data["items"][1]["amount"])


@pytest.mark.asyncio
async def test_payment_pagination(client: AsyncClient) -> None:
    """Test pagination for payments."""
    seed = await _seed_job(client)
    
    # Create multiple payments
    for i in range(5):
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/payments",
            json={
                "job_id": seed["job"]["id"],
                "payment_type": "deposit",
                "payment_method": "cash",
                "percentage": "10.00",
                "amount": "5000.00",
            },
        )
    
    # Get first page
    response = await client.get(
        f"/api/v1/jobs/{seed['job']['id']}/payments?limit=2&offset=0"
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 5
    assert len(data["items"]) == 2
    assert data["limit"] == 2
    assert data["offset"] == 0


@pytest.mark.asyncio
async def test_multiple_jobs_payment_order_independence(client: AsyncClient) -> None:
    """Test that payment_order is independent per job."""
    seed1 = await _seed_job(client)
    seed2 = await _seed_job(client)
    
    # Create payment for job 1
    payment1 = (
        await client.post(
            f"/api/v1/jobs/{seed1['job']['id']}/payments",
            json={
                "job_id": seed1["job"]["id"],
                "payment_type": "deposit",
                "payment_method": "cash",
                "percentage": "70.00",
                "amount": "35000.00",
            },
        )
    ).json()
    
    # Create payment for job 2
    payment2 = (
        await client.post(
            f"/api/v1/jobs/{seed2['job']['id']}/payments",
            json={
                "job_id": seed2["job"]["id"],
                "payment_type": "deposit",
                "payment_method": "cash",
                "percentage": "70.00",
                "amount": "35000.00",
            },
        )
    ).json()
    
    # Both should have payment_order = 1
    assert payment1["payment_order"] == 1
    assert payment2["payment_order"] == 1


@pytest.mark.asyncio
async def test_payment_status_cancelled(client: AsyncClient) -> None:
    """Test cancelling a payment."""
    seed = await _seed_job(client)
    payment = (
        await client.post(
            f"/api/v1/jobs/{seed['job']['id']}/payments",
            json={
                "job_id": seed["job"]["id"],
                "payment_type": "deposit",
                "payment_method": "cash",
                "percentage": "70.00",
                "amount": "35000.00",
            },
        )
    ).json()
    
    # Cancel payment
    response = await client.patch(
        f"/api/v1/payments/{payment['id']}/status",
        json={"status": "cancelled"},
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "cancelled"
    
    # Try to change from cancelled (terminal)
    response2 = await client.patch(
        f"/api/v1/payments/{payment['id']}/status",
        json={"status": "pending"},
    )
    
    assert response2.status_code == 422
    assert "terminal" in response2.json()["detail"].lower()
