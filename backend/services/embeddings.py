from __future__ import annotations

from typing import List, Sequence

import environment
from langchain_openai import OpenAIEmbeddings
from langchain_ollama import OllamaEmbeddings
from langchain_core.embeddings import Embeddings


_EMBEDDINGS_SINGLETON: Embeddings | None = None


def _provider() -> str:
    return environment.EMBEDDINGS_PROVIDER.strip().lower()


def _default_model() -> str:
    if _provider() == "ollama":
        return environment.OLLAMA_EMBEDDING_MODEL
    return environment.OPENAI_EMBEDDING_MODEL


def embedding_dimension() -> int:
    model = _default_model()
    if _provider() == "ollama":
        ollama_dims = {
            "nomic-embed-text": 768,
            "nomic-embed-text:latest": 768,
            "all-minilm": 384,
        }
        return ollama_dims.get(model, 768)

    # OpenAI defaults
    openai_dims = {
        "text-embedding-3-small": 1536,
        "text-embedding-3-large": 3072,
    }
    return openai_dims.get(model, 1536)


def get_embeddings() -> Embeddings:
    global _EMBEDDINGS_SINGLETON
    if _EMBEDDINGS_SINGLETON is None:
        model = _default_model()
        if _provider() == "ollama":
            base_url = environment.OLLAMA_BASE_URL
            if base_url:
                _EMBEDDINGS_SINGLETON = OllamaEmbeddings(model=model, base_url=base_url)
            else:
                _EMBEDDINGS_SINGLETON = OllamaEmbeddings(model=model)
        else:
            # Rely on environment for API key by default; pass explicitly if present
            kwargs = {"model": model}
            kwargs["api_key"] = environment.OPENAI_API_KEY
            _EMBEDDINGS_SINGLETON = OpenAIEmbeddings(**kwargs)
    return _EMBEDDINGS_SINGLETON


def embed_text(text: str) -> List[float]:
    return get_embeddings().embed_query(text)


def embed_documents(texts: Sequence[str]) -> List[List[float]]:
    return get_embeddings().embed_documents(list(texts))


__all__ = [
    "get_embeddings",
    "embed_text",
    "embed_documents",
    "embedding_dimension",
]


