from datetime import date, datetime, timedelta

from conftest import auth_headers, login, make_employee, next_bookable_weekday

from app.models import DailyBooking, FloorConfig


def fill_wfo(db, team, d, count, prefix="filler"):
    """Insert `count` WFO bookings for date d with strictly increasing created_on,
    so FCFS ordering is deterministic. Returns the list of created bookings."""
    base = datetime(2020, 1, 1)
    bookings = []
    for i in range(count):
        emp = make_employee(db, team, f"{prefix}{i}", f"{prefix}{i}@test.example.com")
        b = DailyBooking(
            employee_id=emp.id,
            booking_date=d,
            status="WFO",
            slot_number=i + 1,
            created_on=base + timedelta(seconds=i),
        )
        db.add(b)
        bookings.append(b)
    db.commit()
    for b in bookings:
        db.refresh(b)
    return bookings


def test_show_full_at_default_capacity(client, db, team):
    d = next_bookable_weekday()
    fill_wfo(db, team, d, 63)
    latecomer = make_employee(db, team, "Latecomer", "latecomer@test.example.com")
    token = login(client, latecomer.email)

    resp = client.post("/bookings", json={"booking_date": d.isoformat(), "status": "WFO"}, headers=auth_headers(token))
    assert resp.status_code == 409
    assert "Show Full — all 63" in resp.json()["detail"]


def test_manager_increase_reopens_show_full_date(client, db, team, manager):
    d = next_bookable_weekday()
    fill_wfo(db, team, d, 63)

    mgr_token = login(client, manager.email)
    resp = client.put(
        "/config/capacity",
        json={"seat_count": 70, "effective_from": date.today().isoformat()},
        headers=auth_headers(mgr_token),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["old_count"] == 63
    assert body["new_count"] == 70
    assert body["released"] == 0

    latecomer = make_employee(db, team, "Latecomer", "latecomer@test.example.com")
    token = login(client, latecomer.email)
    resp = client.post("/bookings", json={"booking_date": d.isoformat(), "status": "WFO"}, headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json()["slot_number"] == 64


def test_admin_reduce_converts_overflow_to_wfh_fcfs(client, db, team, admin):
    d = next_bookable_weekday()
    bookings = fill_wfo(db, team, d, 58)

    admin_token = login(client, admin.email)
    resp = client.put(
        "/config/capacity",
        json={"seat_count": 50, "effective_from": date.today().isoformat()},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["old_count"] == 63  # default capacity before any config row existed
    assert body["new_count"] == 50
    assert body["released"] == 8

    db.expire_all()
    kept = (
        db.query(DailyBooking)
        .filter_by(booking_date=d, status="WFO")
        .order_by(DailyBooking.created_on)
        .all()
    )
    released = (
        db.query(DailyBooking)
        .filter_by(booking_date=d, status="WFH")
        .order_by(DailyBooking.created_on)
        .all()
    )
    assert len(kept) == 50
    assert len(released) == 8

    # Earliest 50 by created_on kept WFO, slots compacted to 1..50
    earliest_ids = {b.employee_id for b in bookings[:50]}
    assert {b.employee_id for b in kept} == earliest_ids
    assert sorted(b.slot_number for b in kept) == list(range(1, 51))

    # Latest 8 released to WFH with no slot
    latest_ids = {b.employee_id for b in bookings[50:]}
    assert {b.employee_id for b in released} == latest_ids
    assert all(b.slot_number is None for b in released)


def test_employee_ranked_45th_keeps_wfo_slot(client, db, team, admin):
    d = next_bookable_weekday()
    bookings = fill_wfo(db, team, d, 58)

    admin_token = login(client, admin.email)
    client.put(
        "/config/capacity",
        json={"seat_count": 50, "effective_from": date.today().isoformat()},
        headers=auth_headers(admin_token),
    )

    ranked_45th = bookings[44]  # 0-indexed -> 45th by created_on
    db.expire_all()
    refreshed = db.query(DailyBooking).filter_by(employee_id=ranked_45th.employee_id, booking_date=d).first()
    assert refreshed.status == "WFO"
    assert refreshed.slot_number is not None
    assert refreshed.slot_number <= 50


def test_set_capacity_out_of_range_rejected(client, manager):
    token = login(client, manager.email)
    for bad in (5, 250):
        resp = client.put(
            "/config/capacity",
            json={"seat_count": bad, "effective_from": date.today().isoformat()},
            headers=auth_headers(token),
        )
        assert resp.status_code == 400
        assert "10 and 200" in resp.json()["detail"]


def test_employee_forbidden_to_set_capacity(client, employee):
    token = login(client, employee.email)
    resp = client.put(
        "/config/capacity",
        json={"seat_count": 70, "effective_from": date.today().isoformat()},
        headers=auth_headers(token),
    )
    assert resp.status_code == 403


def test_employee_forbidden_full_capacity_get_but_date_scoped_read_works(client, employee):
    token = login(client, employee.email)
    headers = auth_headers(token)

    resp = client.get("/config/capacity", headers=headers)
    assert resp.status_code == 403

    resp = client.get("/config/capacity", params={"date": date.today().isoformat()}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["seat_count"] == 63


def test_preview_does_not_change_data(client, db, team, manager):
    d = next_bookable_weekday()
    fill_wfo(db, team, d, 58)

    token = login(client, manager.email)
    resp = client.get(
        "/config/capacity/preview",
        params={"seat_count": 50, "effective_from": date.today().isoformat()},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["released"] == 8
    assert body["old_count"] == 63
    assert body["new_count"] == 50

    assert db.query(FloorConfig).count() == 0
    assert db.query(DailyBooking).filter_by(booking_date=d, status="WFH").count() == 0
    assert db.query(DailyBooking).filter_by(booking_date=d, status="WFO").count() == 58


def test_future_effective_capacity_does_not_affect_earlier_bookable_date(client, db, team, manager):
    d = next_bookable_weekday()
    fill_wfo(db, team, d, 63)

    token = login(client, manager.email)
    resp = client.put(
        "/config/capacity",
        json={"seat_count": 70, "effective_from": (d + timedelta(days=1)).isoformat()},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200, resp.text

    latecomer = make_employee(db, team, "Latecomer", "latecomer@test.example.com")
    latecomer_token = login(client, latecomer.email)
    resp = client.post("/bookings", json={"booking_date": d.isoformat(), "status": "WFO"}, headers=auth_headers(latecomer_token))
    assert resp.status_code == 409
    assert "Show Full — all 63" in resp.json()["detail"]
