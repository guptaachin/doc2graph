from fastapi import Query, APIRouter, HTTPException, UploadFile, File, Body
from services.knowledge_graph import (
    list_files as svc_list_files,
    ingest_text_file as svc_ingest_text_file,
    ingest_url as svc_ingest_url,
    get_graph as svc_get_graph,
    ask_question as svc_ask_question,
)


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
        return svc_ask_question(user_id=DEFAULT_USER_ID, question=question, filenames=filenames)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QA error: {str(e)}")


@router.get("/files")
async def list_files():
    try:
        return svc_list_files(DEFAULT_USER_ID)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"List files error: {str(e)}")


@router.post("/ingest-text")
async def ingest_text(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        return svc_ingest_text_file(DEFAULT_USER_ID, file.filename, contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest error: {str(e)}")


@router.post("/ingest-url")
async def ingest_url(url: str = Body(..., embed=True)):
    try:
        return await svc_ingest_url(DEFAULT_USER_ID, url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest URL error: {str(e)}")


@router.get("/graph")
async def get_graph():
    try:
        return svc_get_graph(DEFAULT_USER_ID)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Graph error: {str(e)}")
