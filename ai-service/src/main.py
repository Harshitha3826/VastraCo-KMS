import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import router, set_bedrock_status

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: validate that the Bedrock credentials and model access work before
    accepting traffic.  Runs the boto3 converse call in a thread pool so it does
    not block the async event loop.

    The service will log a clear error and mark itself unhealthy (via the /health
    endpoint) if validation fails, rather than crashing — this keeps the container
    alive so Docker logs remain accessible for diagnosis.
    """
    from src.bedrock_client import bedrock_runtime, validate_bedrock_connectivity

    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(
            None, validate_bedrock_connectivity, bedrock_runtime
        )
        set_bedrock_status(healthy=True)
    except Exception as exc:
        logger.error(
            "⚠️  Bedrock validation failed at startup — AI responses will not work "
            "until this is resolved.  Error: %s", exc
        )
        set_bedrock_status(healthy=False)

    yield  # service is running

    # Shutdown — nothing to clean up (MemorySaver is in-process)
    logger.info("AI service shutting down.")


app = FastAPI(
    title="VastraCo AI Service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:80"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/ai")
