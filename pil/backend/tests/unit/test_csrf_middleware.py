import pytest
from httpx import ASGITransport, AsyncClient
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route

from app.middleware.csrf import CSRFMiddleware


async def _echo(request):
    return JSONResponse({"ok": True})


def _build_app() -> Starlette:
    app = Starlette(routes=[Route("/mutate", _echo, methods=["POST"])])
    app.add_middleware(CSRFMiddleware)
    return app


@pytest.fixture
async def client():
    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_cookie_authenticated_mutation_without_csrf_token_rejected(client: AsyncClient) -> None:
    response = await client.post("/mutate", cookies={"scv_refresh": "sometoken"})
    assert response.status_code == 403


async def test_cookie_authenticated_mutation_with_matching_csrf_accepted(client: AsyncClient) -> None:
    response = await client.post(
        "/mutate",
        cookies={"scv_csrf": "abc123"},
        headers={"X-CSRF-Token": "abc123"},
    )
    assert response.status_code == 200


async def test_cookie_authenticated_mutation_with_mismatched_csrf_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/mutate",
        cookies={"scv_csrf": "abc123"},
        headers={"X-CSRF-Token": "different"},
    )
    assert response.status_code == 403


async def test_bearer_authenticated_mutation_bypasses_csrf_check(client: AsyncClient) -> None:
    # Required for the forced MFA-enrollment / forced password-change flows, which use
    # a single-purpose Bearer token issued before any CSRF cookie exists — see
    # app/middleware/csrf.py module docstring for the full rationale.
    response = await client.post("/mutate", headers={"Authorization": "Bearer some.jwt.token"})
    assert response.status_code == 200


async def test_get_request_never_requires_csrf(client: AsyncClient) -> None:
    app = _build_app()
    app.router.routes.append(Route("/mutate", _echo, methods=["GET"]))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/mutate")
    assert response.status_code == 200
