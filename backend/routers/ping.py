from fastapi import APIRouter, HTTPException
import time

router = APIRouter()

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
        res = kg.query("RETURN 1 AS ok")
        latency_ms = int((time.time() - start) * 1000)
        return {"status": "ok", "neo4j": "up", "latency_ms": latency_ms, "result": res}
    except Exception as e:
        raise HTTPException(status_code=503, detail={"status": "error", "neo4j": "down", "error": str(e)})
