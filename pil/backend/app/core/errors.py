"""RFC 7807 problem+json error handling.

Rule: no stack traces, SQL text, file paths, or library versions ever reach the client.
Unexpected exceptions are logged in full server-side and returned to the client as a
generic 500 with no detail — this is a deliberate anti-information-disclosure control,
not an oversight to "fix" by adding more detail later.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger

logger = get_logger(__name__)

PROBLEM_JSON = "application/problem+json"


class AppError(Exception):
    """Base class for application errors that are safe to describe to the client."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    title: str = "Bad Request"

    def __init__(self, detail: str | None = None, **extra: Any) -> None:
        self.detail = detail
        self.extra = extra
        super().__init__(detail or self.title)


class NotAuthenticatedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    title = "Authentication required"


class PermissionDeniedError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    title = "Permission denied"


class ResourceNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    title = "Resource not found"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    title = "Conflict"


class RateLimitedError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    title = "Too many requests"


class AccountLockedHttpError(AppError):
    status_code = status.HTTP_423_LOCKED
    title = "Account locked"


def _problem_response(status_code: int, title: str, detail: str | None, instance: str) -> JSONResponse:
    body = {
        "type": "about:blank",
        "title": title,
        "status": status_code,
        "instance": instance,
    }
    if detail:
        body["detail"] = detail
    return JSONResponse(status_code=status_code, content=body, media_type=PROBLEM_JSON)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return _problem_response(exc.status_code, exc.title, exc.detail, str(request.url.path))

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _problem_response(
            exc.status_code, "HTTP error", str(exc.detail) if exc.detail else None, str(request.url.path)
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Field-level validation feedback is safe and expected; internal exception
        # text/tracebacks are still never included.
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            media_type=PROBLEM_JSON,
            content={
                "type": "about:blank",
                "title": "Validation error",
                "status": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "instance": str(request.url.path),
                "errors": exc.errors(),
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "unhandled_exception",
            path=str(request.url.path),
            exc_type=type(exc).__name__,
            exc_info=True,
        )
        return _problem_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Internal server error",
            None,
            str(request.url.path),
        )
