from datetime import date, timedelta

from conftest import auth_headers, login, make_employee, next_bookable_weekday

from app.models import DailyBooking


def test_weekend_booking_rejected(client, db, employee):
    token = login(client, employee.email)
    d = date.today() + timedelta(days=1)
    while d.weekday() != 5:  # next Saturday
        d += timedelta(days=1)

    resp = client.post(
        "/bookings",
        json={"booking_date": d.isoformat(), "status": "WFO"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 400
    assert "Weekend" in resp.json()["detail"]


def test_duplicate_status_rejected(client, db, employee):
    token = login(client, employee.email)
    headers = auth_headers(token)
    d = next_bookable_weekday()

    first = client.post("/bookings", json={"booking_date": d.isoformat(), "status": "WFH"}, headers=headers)
    assert first.status_code == 200

    second = client.post("/bookings", json={"booking_date": d.isoformat(), "status": "WFH"}, headers=headers)
    assert second.status_code == 409
    assert "Already marked" in second.json()["detail"]


def test_closed_day_requires_approval(client, db, employee):
    token = login(client, employee.email)
    yesterday = date.today() - timedelta(days=1)

    resp = client.post(
        "/bookings",
        json={"booking_date": yesterday.isoformat(), "status": "WFH"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 403
    assert "closed" in resp.json()["detail"].lower()


def test_show_full_on_64th_wfo_booking(client, db, team):
    d = next_bookable_weekday()

    for i in range(63):
        emp = make_employee(db, team, f"Filler {i}", f"filler{i}@test.example.com")
        db.add(DailyBooking(employee_id=emp.id, booking_date=d, status="WFO", slot_number=i + 1))
    db.commit()

    latecomer = make_employee(db, team, "Latecomer", "latecomer@test.example.com")
    token = login(client, latecomer.email)

    resp = client.post(
        "/bookings",
        json={"booking_date": d.isoformat(), "status": "WFO"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 409
    assert "Show Full" in resp.json()["detail"]


def test_wfo_booking_gets_auto_slot(client, db, employee):
    token = login(client, employee.email)
    d = next_bookable_weekday()

    resp = client.post(
        "/bookings",
        json={"booking_date": d.isoformat(), "status": "WFO"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["slot_number"] == 1
