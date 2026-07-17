from datetime import date, timedelta

from conftest import auth_headers, login, make_employee

from app.models import DailyBooking, FloorConfig, Holiday


def _window_weekdays():
    """The 7-day booking window (today+1..today+7) always contains exactly 5 weekdays."""
    return [
        date.today() + timedelta(days=n)
        for n in range(1, 8)
        if (date.today() + timedelta(days=n)).weekday() < 5
    ]


def test_bulk_partial_success_with_itemized_skips(client, db, team, employee):
    dates = _window_weekdays()
    assert len(dates) == 5
    holiday_day, full_day = dates[1], dates[2]

    db.add(Holiday(holiday_date=holiday_day, name="Founder's Day"))
    for i in range(63):
        filler = make_employee(db, team, f"Filler {i}", f"bulkfiller{i}@test.example.com")
        db.add(DailyBooking(employee_id=filler.id, booking_date=full_day, status="WFO", slot_number=i + 1))
    db.commit()

    token = login(client, employee.email)
    resp = client.post(
        "/bookings/bulk",
        json={"dates": [d.isoformat() for d in dates], "status": "WFO"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["booked"]) == 3
    assert len(body["skipped"]) == 2

    reasons = {s["date"]: s["reason"] for s in body["skipped"]}
    assert "shut down" in reasons[holiday_day.isoformat()].lower()
    assert "show full" in reasons[full_day.isoformat()].lower()


def test_bulk_checks_each_date_against_its_own_capacity(client, db, team, employee):
    d1, d2 = _window_weekdays()[:2]
    db.add(FloorConfig(seat_count=70, effective_from=d2))
    for i in range(63):
        filler = make_employee(db, team, f"Capfiller {i}", f"capfiller{i}@test.example.com")
        db.add(DailyBooking(employee_id=filler.id, booking_date=d1, status="WFO", slot_number=i + 1))
        db.add(DailyBooking(employee_id=filler.id, booking_date=d2, status="WFO", slot_number=i + 1))
    db.commit()

    token = login(client, employee.email)
    resp = client.post(
        "/bookings/bulk",
        json={"dates": [d1.isoformat(), d2.isoformat()], "status": "WFO"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    body = resp.json()

    booked_dates = {b["booking_date"] for b in body["booked"]}
    skipped_dates = {s["date"] for s in body["skipped"]}
    assert booked_dates == {d2.isoformat()}
    assert skipped_dates == {d1.isoformat()}
    assert "show full" in body["skipped"][0]["reason"].lower()


def test_bulk_skips_locked_past_date_without_approval(client, db, employee):
    past_weekday = date.today() - timedelta(days=1)
    while past_weekday.weekday() >= 5:
        past_weekday -= timedelta(days=1)
    future = _window_weekdays()[0]

    token = login(client, employee.email)
    resp = client.post(
        "/bookings/bulk",
        json={"dates": [past_weekday.isoformat(), future.isoformat()], "status": "WFH"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    body = resp.json()

    assert len(body["booked"]) == 1
    assert body["booked"][0]["booking_date"] == future.isoformat()
    assert len(body["skipped"]) == 1
    assert body["skipped"][0]["date"] == past_weekday.isoformat()
    assert "closed" in body["skipped"][0]["reason"].lower()


def test_bulk_requires_at_least_one_date(client, db, employee):
    token = login(client, employee.email)
    resp = client.post(
        "/bookings/bulk",
        json={"dates": [], "status": "WFO"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 400
    assert "at least one date" in resp.json()["detail"].lower()
