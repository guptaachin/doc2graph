from dotenv import load_dotenv
load_dotenv()

from logger import setup_logger
logger = setup_logger(__name__)

import os

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ENV = os.getenv("ENV")

DISCORD_BOT_TOKEN=os.getenv("DISCORD_BOT_TOKEN")

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASS = os.getenv("NEO4J_PASS")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
EMBEDDINGS_PROVIDER = os.getenv("EMBEDDINGS_PROVIDER", "ollama")
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

# Optional embedding configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL")
