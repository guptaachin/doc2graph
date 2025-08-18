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