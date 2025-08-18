from fastapi import Query, APIRouter, HTTPException, UploadFile, File, Body
from utils.knowledge_graph import (
    ask_question,
    create_file_knowledge_graph,
    kg,
)
import httpx
import re


router = APIRouter()

DEFAULT_USER_ID = "guest-user"



@router.post("/qa")
async def qa_endpoint(
    question: str = Query(...),
    filenames: list = Query(None),
):
    if not question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    try:
        return ask_question(user_id=DEFAULT_USER_ID, question=question, filenames=filenames)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QA error: {str(e)}")


@router.get("/files")
async def list_files():
    try:
        result = kg.query(
            """
            MATCH (u:User {user_id: $user_id})-[:UPLOADED]->(f:File)
            RETURN f.filename AS filename,
                   f.total_chunks AS total_chunks,
                   f.processed_date AS processed_date
            ORDER BY f.filename
            """,
            params={"user_id": DEFAULT_USER_ID},
        )
        return [
            {
                "filename": r.get("filename"),
                "total_chunks": r.get("total_chunks"),
                "processed_date": r.get("processed_date"),
            }
            for r in (result or [])
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"List files error: {str(e)}")


@router.post("/ingest-text")
async def ingest_text(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only .txt files are supported")
    contents = await file.read()
    if len(contents) > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Total size exceeds 100 MB limit")
    try:
        result = create_file_knowledge_graph(
            user_id=DEFAULT_USER_ID,
            filename=file.filename,
            file_contents=contents,
            content_type="text/plain",
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest error: {str(e)}")


def _strip_html(html: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


@router.post("/ingest-url")
async def ingest_url(url: str = Body(..., embed=True)):
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, follow_redirects=True)
            resp.raise_for_status()
            content_bytes = resp.content
            if len(content_bytes) > 100 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="Total size exceeds 100 MB limit")
            try:
                text = content_bytes.decode("utf-8", errors="ignore")
            except Exception:
                text = content_bytes.decode(errors="ignore")
            plain = _strip_html(text)
            result = create_file_knowledge_graph(
                user_id=DEFAULT_USER_ID,
                filename=url,
                file_contents=plain.encode("utf-8"),
                content_type="text/plain",
            )
            return result
    except httpx.HTTPError as he:
        raise HTTPException(status_code=400, detail=f"Fetch failed: {str(he)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest URL error: {str(e)}")


@router.get("/graph")
async def get_graph():
    try:
        data = kg.query(
            """
            MATCH (u:User {user_id: $user_id})-[:UPLOADED]->(f:File)
            OPTIONAL MATCH (f)-[:HAS_CHUNK]->(c:Chunk)
            RETURN f.filename AS filename, collect({id: c.id, idx: c.chunk_index}) AS chunks
            """,
            params={"user_id": DEFAULT_USER_ID},
        )
        nodes = []
        edges = []
        for row in data or []:
            file_id = f"file::{row['filename']}"
            nodes.append({"id": file_id, "label": row["filename"], "type": "file"})
            for ch in row.get("chunks", []) or []:
                if not ch or ch.get("id") is None:
                    continue
                chunk_id = ch["id"]
                nodes.append({"id": chunk_id, "label": str(ch.get("idx", "")), "type": "chunk"})
                edges.append({"source": file_id, "target": chunk_id, "type": "HAS_CHUNK"})
        next_rows = kg.query(
            """
            MATCH (c1:Chunk)-[:NEXT]->(c2:Chunk)
            RETURN c1.id AS s, c2.id AS t
            """
        )
        for r in next_rows or []:
            if r.get("s") and r.get("t"):
                edges.append({"source": r["s"], "target": r["t"], "type": "NEXT"})
        unique_nodes = {n["id"]: n for n in nodes}.values()
        return {"nodes": list(unique_nodes), "edges": edges}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Graph error: {str(e)}")
