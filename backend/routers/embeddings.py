from fastapi import APIRouter, Body, HTTPException, Query
import environment
from services.embeddings import embed_text, embedding_dimension


router = APIRouter()


@router.post("/test-embedding")
async def test_embedding(
    text: str = Body(..., embed=True),
    include_vector: bool = Query(False),
):
    try:
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        vector = embed_text(text)
        provider = environment.EMBEDDINGS_PROVIDER.strip().lower() if environment.EMBEDDINGS_PROVIDER else "openai"
        model = (
            environment.OLLAMA_EMBEDDING_MODEL if provider == "ollama" else environment.OPENAI_EMBEDDING_MODEL
        )
        expected_dim = embedding_dimension()
        actual_dim = len(vector) if vector else 0

        response = {
            "status": "success",
            "provider": provider,
            "model": model,
            "expected_dimension": expected_dim,
            "actual_dimension": actual_dim,
            "dimension_matches": actual_dim == expected_dim,
            "sample": vector[:8] if vector else [],
        }
        if include_vector:
            response["vector"] = vector
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")


