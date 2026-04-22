# ---------- Stage 1: build the Next.js frontend as a static export ----------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install deps using the lockfile for reproducibility when present.
COPY frontend/package.json frontend/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; \
    else npm install --no-audit --no-fund; fi

COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# ---------- Stage 2: Python backend serving everything ----------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install -r /app/backend/requirements.txt

COPY backend/ /app/backend/

# Drop the built frontend into the location main.py expects.
COPY --from=frontend-builder /app/frontend/out /app/backend/app/static

RUN mkdir -p /app/backend/data

WORKDIR /app/backend

ENV PORT=8080 \
    DATABASE_URL=sqlite+aiosqlite:////app/backend/data/dictionary.db

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
