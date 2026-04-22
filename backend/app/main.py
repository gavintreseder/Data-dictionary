import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.database import init_db
from app.routers import lookup, sources, terms
from app.seed.loader import seed_database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    await init_db()
    if settings.seed_on_startup:
        added = await seed_database()
        if added:
            logger.info("Seeded %s term(s)", added)
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(terms.router)
app.include_router(lookup.router)
app.include_router(sources.router)


@app.get("/api/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok", "app": settings.app_name}


STATIC_DIR = Path(settings.static_dir)


def _mount_static() -> None:
    if not STATIC_DIR.exists():
        logger.info("Static dir %s not present; skipping frontend mount", STATIC_DIR)
        return

    next_dir = STATIC_DIR / "_next"
    if next_dir.exists():
        app.mount("/_next", StaticFiles(directory=next_dir), name="_next")

    @app.exception_handler(StarletteHTTPException)
    async def spa_fallback(request, exc):  # type: ignore[override]
        path = request.url.path
        if exc.status_code == 404 and not path.startswith("/api"):
            index = STATIC_DIR / "index.html"
            if index.exists():
                return FileResponse(index)
        return JSONResponse(
            {"detail": exc.detail}, status_code=exc.status_code
        )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_catchall(full_path: str):
        if full_path.startswith("api"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        candidate = STATIC_DIR / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        html_candidate = STATIC_DIR / f"{full_path}.html"
        if html_candidate.is_file():
            return FileResponse(html_candidate)
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(index)
        return JSONResponse({"detail": "Frontend not built"}, status_code=404)


_mount_static()
