## Links
- Backend swagger: http://localhost:8000/docs  

## Commands
- Create virtual env and activate: 
    ```
    python3 -m venv .venv
    source .venv/bin/activate  
    pip install -r requirements.txt
    .venv/bin/python3 -m pip install --upgrade pip
    ```
- Bring up application: `docker compose up --build`
- Run - `uvicorn main:app --reload --host 0.0.0.0 --port 8000`

## .env

```
JWT_SECRET=supersecretbuildathonkey
JWT_ALGORITHM=HS256
SESSION_SECRET_KEY=your_super_secret_key_here
ENV=dev # Bypass client bearer token auth

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASS=please-set-me

# Embeddings provider: openai | ollama
EMBEDDINGS_PROVIDER=openai

# OpenAI (used when EMBEDDINGS_PROVIDER=openai)
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
# Optional
# OPENAI_EMBEDDING_DIMENSIONS=1536

# Ollama (used when EMBEDDINGS_PROVIDER=ollama)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
# Optional
# OLLAMA_EMBEDDING_DIM=768

# Unified optional overrides for dimensions (first non-empty is used)
# EMBEDDING_DIM=
# EMBEDDINGS_DIM=
```

## New url registration
Everytime we get a new url register in console - https://console.cloud.google.com/apis/credentials?inv=1&invt=Ab5KIw&project=personal-468520 
# Mongo removed
Join Discord server for notifications - https://discord.gg/jsyHVhSp