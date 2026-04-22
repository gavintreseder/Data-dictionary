from fastapi import APIRouter

from app.config import llm_enabled, settings
from app.seed.loader import reset_database

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/system")
async def system_info() -> dict:
    # Preference order matches llm_service._invoke: groq → ollama → hf
    if settings.groq_api_key:
        active = f"groq:{settings.groq_model}"
    elif settings.ollama_url:
        active = f"ollama:{settings.ollama_model}"
    elif settings.hf_api_token:
        active = f"hf:{settings.hf_model}"
    else:
        active = "heuristic"

    return {
        "app": settings.app_name,
        "environment": settings.environment,
        "llm": {
            "enabled": llm_enabled(),
            "groq": bool(settings.groq_api_key),
            "ollama": bool(settings.ollama_url),
            "huggingface": bool(settings.hf_api_token),
            "model": active,
        },
    }


@router.post("/demo/reset")
async def demo_reset() -> dict:
    added = await reset_database()
    return {"status": "ok", "seeded": added}
