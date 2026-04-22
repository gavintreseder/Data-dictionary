from fastapi import APIRouter

from app.config import llm_enabled, settings
from app.seed.loader import reset_database

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/system")
async def system_info() -> dict:
    return {
        "app": settings.app_name,
        "environment": settings.environment,
        "llm": {
            "enabled": llm_enabled(),
            "ollama": bool(settings.ollama_url),
            "huggingface": bool(settings.hf_api_token),
            "model": (
                settings.ollama_model
                if settings.ollama_url
                else settings.hf_model
                if settings.hf_api_token
                else "heuristic"
            ),
        },
    }


@router.post("/demo/reset")
async def demo_reset() -> dict:
    added = await reset_database()
    return {"status": "ok", "seeded": added}
