# Universal Knowledge Graph Builder

A full-stack application that converts TXT files and URLs into an interactive knowledge graph. Built with React frontend, FastAPI backend, and Neo4j database.

## Features

- 📄 **Content Ingestion**: Upload TXT files or provide URLs to extract and process content
- 🗺️ **Graph Visualization**: Interactive knowledge graph with nodes and relationships
- ❓ **Natural Language Q&A**: Ask questions about your knowledge graph in natural language
- 🔍 **Graph Exploration**: Navigate through connected concepts and entities

## Architecture

- **Frontend**: React 19 with modern UI components
- **Backend**: FastAPI with Python 3.11
- **Database**: Neo4j 5 for graph storage
- **AI/ML**: LangChain integration with OpenAI/Ollama for text processing

## Quick Start with Docker

### Prerequisites

- Docker and Docker Compose installed on your system
- At least 4GB of available RAM (recommended 8GB)
- Ports 3000, 8000, 7474, and 7687 available

### One-Command Setup

1. **Clone and navigate to the project:**
   ```bash
   git clone <your-repo-url>
   cd doc2graph
   ```

2. **Start all services:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:8000
   - **Neo4j Browser**: http://localhost:7474 (username: `neo4j`, password: `neo4j1234`)

### Service Details

The docker-compose file brings up three services:

#### 🗄️ Neo4j Database
- **Port**: 7474 (Browser), 7687 (Bolt)
- **Credentials**: neo4j / neo4j1234
- **Plugins**: APOC, Graph Data Science
- **Memory**: 1GB heap, 512MB pagecache

#### 🚀 Backend API
- **Port**: 8000
- **Framework**: FastAPI with auto-reload
- **Features**: REST API, file processing, graph operations
- **Health Check**: http://localhost:8000/ping

#### 🎨 Frontend App
- **Port**: 3000
- **Framework**: React with Nginx
- **Build**: Optimized production build
- **Routing**: Client-side routing configured for SPA

## Environment Variables

You can customize the setup using environment variables:

```bash
# Create .env file in project root
NEO4J_AUTH=neo4j/your_custom_password
NEO4J_PASSWORD=your_custom_password
REACT_APP_API_URL=http://localhost:8000
```

## Development Mode

For development with hot reload:

```bash
# Start only the database
docker-compose up neo4j -d

# Run backend locally
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Run frontend locally (in another terminal)
cd frontend
npm install
npm start
```

## Usage Instructions

### 1. Ingest Content
- Navigate to the "Ingest" page
- Upload TXT files or provide URLs
- Wait for processing to complete

### 2. Explore the Graph
- Visit the "Graph" page
- Interact with nodes and relationships
- Use zoom and pan to navigate

### 3. Ask Questions
- Go to the "Q&A" page
- Type natural language questions
- Get answers with source references

## API Endpoints

Key backend endpoints:

- `GET /ping` - Health check
- `POST /ingest/text` - Upload text files
- `POST /ingest/url` - Process URLs
- `GET /graph/nodes` - Get graph nodes
- `POST /qa/query` - Ask questions

Full API documentation: http://localhost:8000/docs

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 8000, 7474, 7687 are free
2. **Memory issues**: Neo4j requires sufficient RAM - close other applications if needed
3. **Build failures**: Clear Docker cache with `docker system prune`

### Logs and Debugging

```bash
# View all service logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs neo4j

# Follow logs in real-time
docker-compose logs -f
```

### Reset Everything

```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Remove built images
docker-compose down --rmi all -v

# Start fresh
docker-compose up --build
```

## Stopping the Application

```bash
# Graceful shutdown
docker-compose down

# Stop and remove volumes (deletes all data)
docker-compose down -v
```

## Production Deployment

For production deployment:

1. Update environment variables for security
2. Use proper secrets management
3. Configure reverse proxy (nginx/traefik)
4. Set up SSL certificates
5. Configure backup strategy for Neo4j data

## Support

If you encounter issues:

1. Check the logs: `docker-compose logs`
2. Verify all services are running: `docker-compose ps`
3. Ensure ports are available: `netstat -tulpn | grep :3000`
4. Try rebuilding: `docker-compose up --build --force-recreate`

## License

[Your License Here]
