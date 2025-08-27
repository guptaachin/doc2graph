# Doc2Graph - Knowledge Graph Builder

Convert TXT files and URLs into interactive knowledge graphs with AI-powered Q&A.

**Tech Stack:** React + FastAPI + Neo4j + LangChain

## Quick Start

**Prerequisites:** Docker, Docker Compose, 4GB+ RAM

```bash
git clone git@github.com:guptaachin/doc2graph.git
cd doc2graph
docker-compose up --build
```

**Access:**
- Frontend: http://localhost:3000
- API: http://localhost:8000
- Neo4j: http://localhost:7474 (neo4j/neo4j1234)

## Features

- 📄 Upload TXT files or URLs
- 🗺️ Interactive graph visualization  
- ❓ Natural language Q&A
- 🔍 Graph exploration

## Usage

1. **Ingest** → Upload files/URLs
2. **Graph** → Explore connections
3. **Q&A** → Ask questions

## Development

```bash
# Database only
docker-compose up neo4j -d

# Backend
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# Frontend  
cd frontend && npm install && npm start
```

## Troubleshooting

**Common fixes:**
- Port conflicts: Check 3000, 8000, 7474, 7687
- Memory issues: Close other apps
- Build failures: `docker system prune`

**Reset:**
```bash
docker-compose down -v
docker-compose up --build
```

**Logs:**
```bash
docker-compose logs -f
```
