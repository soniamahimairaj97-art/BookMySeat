from conftest import auth_headers, login


def test_manager_can_add_employee(client, db, manager, team):
    token = login(client, manager.email)

    resp = client.post(
        "/employees",
        json={
            "name": "New Person",
            "email": "newperson@test.example.com",
            "team_id": team.id,
            "role": "employee",
            "password": "pass1234",
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["email"] == "newperson@test.example.com"


def test_duplicate_email_rejected(client, db, manager, team, employee):
    token = login(client, manager.email)

    resp = client.post(
        "/employees",
        json={
            "name": "Dup",
            "email": employee.email,
            "team_id": team.id,
            "role": "employee",
            "password": "pass1234",
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 409


def test_non_manager_cannot_add_employee(client, db, employee, team):
    token = login(client, employee.email)

    resp = client.post(
        "/employees",
        json={
            "name": "Nope",
            "email": "nope@test.example.com",
            "team_id": team.id,
            "role": "employee",
            "password": "pass1234",
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 403
