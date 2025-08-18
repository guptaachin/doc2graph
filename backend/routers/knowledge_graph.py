# routers/knowledge_graph.py
from fastapi import UploadFile, File, Query, APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from typing import List
import environment
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from services.file_service import (
    upload_file_to_gridfs,
    download_file_from_gridfs,
    list_files_from_gridfs,
    delete_file_from_gridfs,
    delete_all_files_from_gridfs,
)
from utils.knowledge_graph import create_file_knowledge_graph, delete_file_knowledge_graph, ask_question

# --- Auth Dependency ---
GOOGLE_CLIENT_ID = f"{environment.GOOGLE_CLIENT_ID}.apps.googleusercontent.com"

def get_current_user(authorization: str = Depends(lambda: None)):
    if environment.ENV == "dev":
        return {"user_id": "local-test-user", "email": "test@example.com"}

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        idinfo = id_token.verify_oauth2_token(
            token, google_requests.Request(), GOOGLE_CLIENT_ID
        )
        return {"user_id": idinfo["sub"], "email": idinfo["email"]}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google token")

# --- Motor Initialization ---
client = AsyncIOMotorClient(environment.MONGO_URI)
db = client[environment.DB_NAME]
fs = AsyncIOMotorGridFSBucket(db)
router = APIRouter()

# --- Knowledge Graph APIs ---
@router.get("/file-download/{filename}")
async def download_file(filename: str, user=Depends(get_current_user)):
    file_info, stream = await download_file_from_gridfs(fs, db, filename, user["user_id"])
    return StreamingResponse(
        stream,
        media_type=file_info.get("metadata", {}).get("content_type", "application/octet-stream"),
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

@router.get("/files", response_model=List[dict])
async def list_files(user=Depends(get_current_user)):
    return await list_files_from_gridfs(db, user["user_id"])

@router.post("/file-upload")
async def upload_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    file_id, contents = await upload_file_to_gridfs(fs, file, user["user_id"])
    try:
        kg_result = create_file_knowledge_graph(
            user_id=user["user_id"],
            filename=file.filename,
            file_contents=contents,
            content_type=file.content_type,
        )
        return {"message": "Uploaded", "id": str(file_id), "knowledge_graph": kg_result}
    except Exception as kg_error:
        return {"message": "Uploaded", "id": str(file_id), "knowledge_graph": {"status": "error", "message": str(kg_error)}}

@router.delete("/files/{filename}")
async def delete_file_endpoint(filename: str, user=Depends(get_current_user)):
    file_info = await delete_file_from_gridfs(fs, db, filename, user["user_id"])
    try:
        kg_result = delete_file_knowledge_graph(file_info["filename"], user["user_id"])
        return {"status": "success", "message": f"File '{filename}' deleted", "knowledge_graph": {"status": "success" if kg_result else "warning"}}
    except Exception as kg_error:
        return {"status": "success", "message": f"File '{filename}' deleted", "knowledge_graph": {"status": "error", "message": str(kg_error)}}

@router.delete("/files")
async def delete_all_files(user=Depends(get_current_user)):
    deleted_count = await delete_all_files_from_gridfs(fs, db, user["user_id"])
    return {"status": "success", "message": f"Deleted {deleted_count} file(s) successfully"}

@router.post("/qa")
async def qa_endpoint(
    question: str = Query(...),
    filenames: list = Query(None),
    user=Depends(get_current_user),
):
    if not question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    try:
        return ask_question(user_id=user["user_id"], question=question, filenames=filenames)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QA error: {str(e)}")
