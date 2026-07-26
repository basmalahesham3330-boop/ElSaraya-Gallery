"""API tests for the Quotation module."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


async def _seed_catalog(client: AsyncClient) -> dict:
    customer = (
        await client.post(
            "/api/v1/customers",
            json={"full_name": "Quotation Client", "phone_number": "01055556666"},
        )
    ).json()
    category = (
        await client.post("/api/v1/product-categories", json={"name": "Windows"})
    ).json()
    product = (
        await client.post(
            "/api/v1/products",
            json={
                "category_id": category["id"],
                "name": "Sliding Window",
                "active": True,
            },
        )
    ).json()
    return {"customer": customer, "category": category, "product": product}


@pytest.mark.asyncio
async def test_create_quotation(client: AsyncClient) -> None:
    seed = await _seed_catalog(client)
    response = await client.post(
        "/api/v1/quotations",
        json={
            "customer_id": seed["customer"]["id"],
            "discount": "0.00",
            "notes": "Draft estimate",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "draft"
    assert data["customer_id"] == seed["customer"]["id"]
    assert data["total_price"] == "0.00"
    assert data["final_price"] == "0.00"
    assert data["quotation_number"].startswith("Q-")


@pytest.mark.asyncio
async def test_add_items_and_calculate_totals(client: AsyncClient) -> None:
    seed = await _seed_catalog(client)
    quotation = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": seed["customer"]["id"]},
        )
    ).json()

    item_resp = await client.post(
        f"/api/v1/quotations/{quotation['id']}/items",
        json={
            "product_id": seed["product"]["id"],
            "quantity": 2,
            "unit_price": "1500.00",
            "description": "White aluminum\nDouble glazed",
        },
    )
    assert item_resp.status_code == 201
    item = item_resp.json()
    assert item["total_price"] == "3000.00"

    updated = await client.put(
        f"/api/v1/quotations/{quotation['id']}",
        json={"discount": "100.00"},
    )
    assert updated.status_code == 200
    assert updated.json()["final_price"] == "2900.00"

    detail = await client.get(f"/api/v1/quotations/{quotation['id']}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["total_price"] == "3000.00"
    assert body["discount"] == "100.00"
    assert body["final_price"] == "2900.00"
    assert len(body["items"]) == 1


@pytest.mark.asyncio
async def test_empty_quotation_cannot_be_sent(client: AsyncClient) -> None:
    seed = await _seed_catalog(client)
    quotation = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": seed["customer"]["id"]},
        )
    ).json()

    response = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "waiting_for_measurement"},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "quotation_requires_items"


@pytest.mark.asyncio
async def test_empty_quotation_cannot_be_approved(client: AsyncClient) -> None:
    """Quotations require at least one item before approval."""
    seed = await _seed_catalog(client)
    quotation = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": seed["customer"]["id"]},
        )
    ).json()

    # Even if we could reach sent status, approval requires items
    response = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "approved"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_invalid_customer(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/quotations",
        json={"customer_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert response.status_code == 404
    assert response.json()["code"] == "EntityNotFoundError"


@pytest.mark.asyncio
async def test_invalid_status_transition(client: AsyncClient) -> None:
    seed = await _seed_catalog(client)
    quotation = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": seed["customer"]["id"]},
        )
    ).json()
    await client.post(
        f"/api/v1/quotations/{quotation['id']}/items",
        json={
            "product_id": seed["product"]["id"],
            "quantity": 1,
            "unit_price": "1000.00",
        },
    )

    # draft → sent is not allowed (must go through waiting_for_measurement)
    response = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "sent"},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_quotation_status_transition"


@pytest.mark.asyncio
async def test_full_lifecycle_happy_path(client: AsyncClient) -> None:
    """Test the complete quotation lifecycle: draft → ... → approved."""
    seed = await _seed_catalog(client)
    quotation = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": seed["customer"]["id"]},
        )
    ).json()
    await client.post(
        f"/api/v1/quotations/{quotation['id']}/items",
        json={
            "product_id": seed["product"]["id"],
            "quantity": 1,
            "unit_price": "2000.00",
            "description": "Custom finish",
        },
    )

    # draft → waiting_for_measurement
    waiting = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "waiting_for_measurement"},
    )
    assert waiting.status_code == 200
    assert waiting.json()["quotation"]["status"] == "waiting_for_measurement"

    # waiting_for_measurement → measured
    measured = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "measured"},
    )
    assert measured.status_code == 200
    assert measured.json()["quotation"]["status"] == "measured"

    # measured → sent (direct path)
    sent = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "sent"},
    )
    assert sent.status_code == 200
    assert sent.json()["quotation"]["status"] == "sent"

    # sent → approved
    approved = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "approved"},
    )
    assert approved.status_code == 200
    assert approved.json()["quotation"]["status"] == "approved"

    # Terminal: cannot change status from approved
    blocked = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "sent"},
    )
    assert blocked.status_code == 422


@pytest.mark.asyncio
async def test_negotiation_flow(client: AsyncClient) -> None:
    """Test the negotiation loop: measured → under_negotiation ↔ sent."""
    seed = await _seed_catalog(client)
    quotation = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": seed["customer"]["id"]},
        )
    ).json()
    await client.post(
        f"/api/v1/quotations/{quotation['id']}/items",
        json={
            "product_id": seed["product"]["id"],
            "quantity": 1,
            "unit_price": "2000.00",
        },
    )

    # Progress to measured state
    await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "waiting_for_measurement"},
    )
    await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "measured"},
    )

    # measured → under_negotiation
    negotiating = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "under_negotiation"},
    )
    assert negotiating.status_code == 200
    assert negotiating.json()["quotation"]["status"] == "under_negotiation"

    # under_negotiation → sent
    sent = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "sent"},
    )
    assert sent.status_code == 200
    assert sent.json()["quotation"]["status"] == "sent"

    # sent → under_negotiation (back to negotiation)
    back_to_negotiation = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "under_negotiation"},
    )
    assert back_to_negotiation.status_code == 200
    assert back_to_negotiation.json()["quotation"]["status"] == "under_negotiation"

    # under_negotiation → sent (send again)
    resent = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "sent"},
    )
    assert resent.status_code == 200
    assert resent.json()["quotation"]["status"] == "sent"

    # sent → rejected (customer declines)
    rejected = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "rejected"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["quotation"]["status"] == "rejected"

    # Terminal: cannot change from rejected
    blocked = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "sent"},
    )
    assert blocked.status_code == 422


@pytest.mark.asyncio
async def test_search_by_status_and_customer(client: AsyncClient) -> None:
    seed = await _seed_catalog(client)
    other = (
        await client.post(
            "/api/v1/customers",
            json={"full_name": "Other Client", "phone_number": "01077778888"},
        )
    ).json()

    q1 = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": seed["customer"]["id"]},
        )
    ).json()
    await client.post(
        f"/api/v1/quotations/{q1['id']}/items",
        json={
            "product_id": seed["product"]["id"],
            "quantity": 1,
            "unit_price": "500.00",
        },
    )
    # Progress through workflow to sent
    await client.patch(
        f"/api/v1/quotations/{q1['id']}/status",
        json={"status": "waiting_for_measurement"},
    )
    await client.patch(
        f"/api/v1/quotations/{q1['id']}/status",
        json={"status": "measured"},
    )
    await client.patch(
        f"/api/v1/quotations/{q1['id']}/status",
        json={"status": "sent"},
    )

    await client.post(
        "/api/v1/quotations",
        json={"customer_id": other["id"]},
    )

    by_status = await client.get("/api/v1/quotations", params={"status": "sent"})
    assert by_status.status_code == 200
    assert by_status.json()["total"] == 1
    assert by_status.json()["items"][0]["status"] == "sent"

    by_customer = await client.get(
        "/api/v1/quotations",
        params={"customer": seed["customer"]["id"]},
    )
    assert by_customer.status_code == 200
    assert by_customer.json()["total"] == 1

    nested = await client.get(
        f"/api/v1/customers/{seed['customer']['id']}/quotations"
    )
    assert nested.status_code == 200
    assert nested.json()["total"] == 1


@pytest.mark.asyncio
async def test_discount_cannot_make_final_price_negative(
    client: AsyncClient,
) -> None:
    seed = await _seed_catalog(client)
    quotation = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": seed["customer"]["id"]},
        )
    ).json()
    await client.post(
        f"/api/v1/quotations/{quotation['id']}/items",
        json={
            "product_id": seed["product"]["id"],
            "quantity": 1,
            "unit_price": "500.00",
        },
    )

    response = await client.put(
        f"/api/v1/quotations/{quotation['id']}",
        json={"discount": "600.00"},
    )
    assert response.status_code == 400
    assert response.json()["code"] == "ValidationError"


@pytest.mark.asyncio
async def test_sent_quotation_cannot_be_edited(client: AsyncClient) -> None:
    seed = await _seed_catalog(client)
    quotation = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": seed["customer"]["id"]},
        )
    ).json()
    await client.post(
        f"/api/v1/quotations/{quotation['id']}/items",
        json={
            "product_id": seed["product"]["id"],
            "quantity": 1,
            "unit_price": "1000.00",
        },
    )
    # Progress to sent
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

    response = await client.put(
        f"/api/v1/quotations/{quotation['id']}",
        json={"notes": "Try to edit while sent"},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "quotation_not_editable"


@pytest.mark.asyncio
async def test_cancelled_status(client: AsyncClient) -> None:
    """Test transitioning to cancelled from allowed states."""
    seed = await _seed_catalog(client)
    
    # Test 1: waiting_for_measurement → cancelled
    q1 = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": seed["customer"]["id"]},
        )
    ).json()
    await client.post(
        f"/api/v1/quotations/{q1['id']}/items",
        json={
            "product_id": seed["product"]["id"],
            "quantity": 1,
            "unit_price": "1000.00",
        },
    )
    await client.patch(
        f"/api/v1/quotations/{q1['id']}/status",
        json={"status": "waiting_for_measurement"},
    )
    cancel_resp = await client.patch(
        f"/api/v1/quotations/{q1['id']}/status",
        json={"status": "cancelled"},
    )
    assert cancel_resp.status_code == 200
    response_data = cancel_resp.json()
    assert response_data["quotation"]["status"] == "cancelled"
    
    # Test 2: under_negotiation → cancelled
    q2 = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": seed["customer"]["id"]},
        )
    ).json()
    await client.post(
        f"/api/v1/quotations/{q2['id']}/items",
        json={
            "product_id": seed["product"]["id"],
            "quantity": 1,
            "unit_price": "1000.00",
        },
    )
    await client.patch(
        f"/api/v1/quotations/{q2['id']}/status",
        json={"status": "waiting_for_measurement"},
    )
    await client.patch(
        f"/api/v1/quotations/{q2['id']}/status",
        json={"status": "measured"},
    )
    await client.patch(
        f"/api/v1/quotations/{q2['id']}/status",
        json={"status": "under_negotiation"},
    )
    cancel_resp2 = await client.patch(
        f"/api/v1/quotations/{q2['id']}/status",
        json={"status": "cancelled"},
    )
    assert cancel_resp2.status_code == 200
    
    # Test 3: sent → cancelled
    q3 = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": seed["customer"]["id"]},
        )
    ).json()
    await client.post(
        f"/api/v1/quotations/{q3['id']}/items",
        json={
            "product_id": seed["product"]["id"],
            "quantity": 1,
            "unit_price": "1000.00",
        },
    )
    await client.patch(
        f"/api/v1/quotations/{q3['id']}/status",
        json={"status": "waiting_for_measurement"},
    )
    await client.patch(
        f"/api/v1/quotations/{q3['id']}/status",
        json={"status": "measured"},
    )
    await client.patch(
        f"/api/v1/quotations/{q3['id']}/status",
        json={"status": "sent"},
    )
    cancel_resp3 = await client.patch(
        f"/api/v1/quotations/{q3['id']}/status",
        json={"status": "cancelled"},
    )
    assert cancel_resp3.status_code == 200


@pytest.mark.asyncio
async def test_terminal_status_transitions(client: AsyncClient) -> None:
    """Verify that terminal statuses cannot transition to any other status."""
    seed = await _seed_catalog(client)
    
    # Helper to create quotation in sent state
    async def create_sent_quotation():
        q = (
            await client.post(
                "/api/v1/quotations",
                json={"customer_id": seed["customer"]["id"]},
            )
        ).json()
        await client.post(
            f"/api/v1/quotations/{q['id']}/items",
            json={
                "product_id": seed["product"]["id"],
                "quantity": 1,
                "unit_price": "1000.00",
            },
        )
        await client.patch(
            f"/api/v1/quotations/{q['id']}/status",
            json={"status": "waiting_for_measurement"},
        )
        await client.patch(
            f"/api/v1/quotations/{q['id']}/status",
            json={"status": "measured"},
        )
        await client.patch(
            f"/api/v1/quotations/{q['id']}/status",
            json={"status": "sent"},
        )
        return q
    
    # Test approved is terminal
    q_approved = await create_sent_quotation()
    await client.patch(
        f"/api/v1/quotations/{q_approved['id']}/status",
        json={"status": "approved"},
    )
    resp = await client.patch(
        f"/api/v1/quotations/{q_approved['id']}/status",
        json={"status": "sent"},
    )
    assert resp.status_code == 422
    
    # Test rejected is terminal
    q_rejected = await create_sent_quotation()
    await client.patch(
        f"/api/v1/quotations/{q_rejected['id']}/status",
        json={"status": "rejected"},
    )
    resp = await client.patch(
        f"/api/v1/quotations/{q_rejected['id']}/status",
        json={"status": "draft"},
    )
    assert resp.status_code == 422
    
    # Test cancelled is terminal
    q_cancelled = await create_sent_quotation()
    await client.patch(
        f"/api/v1/quotations/{q_cancelled['id']}/status",
        json={"status": "cancelled"},
    )
    resp = await client.patch(
        f"/api/v1/quotations/{q_cancelled['id']}/status",
        json={"status": "sent"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_invalid_transition_from_draft(client: AsyncClient) -> None:
    """Draft can only transition to waiting_for_measurement."""
    seed = await _seed_catalog(client)
    quotation = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": seed["customer"]["id"]},
        )
    ).json()
    await client.post(
        f"/api/v1/quotations/{quotation['id']}/items",
        json={
            "product_id": seed["product"]["id"],
            "quantity": 1,
            "unit_price": "1000.00",
        },
    )
    
    # draft → measured (skipping waiting_for_measurement) should fail
    resp = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "measured"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "invalid_quotation_status_transition"


@pytest.mark.asyncio
async def test_measured_to_sent_direct_path(client: AsyncClient) -> None:
    """Test measured can go directly to sent (bypassing negotiation)."""
    seed = await _seed_catalog(client)
    quotation = (
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": seed["customer"]["id"]},
        )
    ).json()
    await client.post(
        f"/api/v1/quotations/{quotation['id']}/items",
        json={
            "product_id": seed["product"]["id"],
            "quantity": 1,
            "unit_price": "1500.00",
        },
    )
    
    await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "waiting_for_measurement"},
    )
    await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "measured"},
    )
    
    # Direct: measured → sent
    resp = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "sent"},
    )
    assert resp.status_code == 200
    assert resp.json()["quotation"]["status"] == "sent"


@pytest.mark.asyncio
async def test_pagination(client: AsyncClient) -> None:
    seed = await _seed_catalog(client)
    for _ in range(3):
        await client.post(
            "/api/v1/quotations",
            json={"customer_id": seed["customer"]["id"]},
        )

    page = await client.get(
        "/api/v1/quotations",
        params={"limit": 2, "offset": 0, "sort_by": "date", "sort_order": "desc"},
    )
    assert page.status_code == 200
    data = page.json()
    assert data["total"] == 3
    assert data["limit"] == 2
    assert data["offset"] == 0
    assert len(data["items"]) == 2
