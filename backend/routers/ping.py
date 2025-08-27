from fastapi import APIRouter, HTTPException
import time
from database.neo import get_neo4j_connection

router = APIRouter()

# Lazy connection - only connect when needed
_kg_connection = None

def get_kg():
    global _kg_connection
    if _kg_connection is None:
        _kg_connection = get_neo4j_connection()
    return _kg_connection

@router.get("/")
async def root():
    return {"message": "Hello! Goto /docs for swagger"}

@router.get("/ping")
async def root():
    return {"message": "pong. Goto /docs for swagger"}

@router.get("/health/db")
async def health_db():
    start = time.time()
    try:
        res = get_kg().query("RETURN 1 AS ok")
        latency_ms = int((time.time() - start) * 1000)
        return {"status": "ok", "neo4j": "up", "latency_ms": latency_ms, "result": res}
    except Exception as e:
        raise HTTPException(status_code=503, detail={"status": "error", "neo4j": "down", "error": str(e)})
