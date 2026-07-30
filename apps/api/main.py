import uuid
import time
import logging
import uvicorn
import sys
import os
import contextvars
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

# Ensure the current directory is in Python path for absolute imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from routes import router

# ContextVar for async-safe request ID propagation in logs
request_id_ctx = contextvars.ContextVar("request_id", default="-")

old_factory = logging.getLogRecordFactory()
def record_factory(*args, **kwargs):
    record = old_factory(*args, **kwargs)
    record.request_id = request_id_ctx.get("-")
    return record
logging.setLogRecordFactory(record_factory)

# Initialize logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] [ReqID: %(request_id)s] %(message)s')
logger = logging.getLogger("wins_hub_api")

app = FastAPI(title="WiNS Hub Unified API", version="1.0.0")

# CORS setup
cors_origins = [x.strip() for x in os.environ.get("WINS_CORS_ORIGINS", "http://127.0.0.1:5174").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
)

# Request ID & Performance measurement middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    request_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
    request.state.request_id = request_id
    token = request_id_ctx.set(request_id)

    start_time = time.time()
    try:
        # Enforce read-only 405 for server-side review identity requests
        if request.headers.get("X-Review-Identity") == "wins-hub-review-readonly":
            if request.method not in ("GET", "HEAD", "OPTIONS"):
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=405,
                    content={"code": "METHOD_NOT_ALLOWED", "message": "Method Not Allowed in Read-Only Review Mode"}
                )

        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        
        response.headers["X-Request-Id"] = request_id
        response.headers["X-Response-Time-Ms"] = f"{process_time:.2f}"
        
        # Log request method/path safely without logging auth headers
        logger.info(f"{request.method} {request.url.path} - Status {response.status_code} in {process_time:.2f}ms")
        return response
    finally:
        request_id_ctx.reset(token)

# Include all modular endpoints
app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000)

