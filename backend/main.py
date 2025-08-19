
from fastapi import FastAPI
# import database.tables as tables
# from database.postgres import engine
from routers import notify, ping , knowledge_graph
from routers import embeddings as embeddings_router
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from environment import FRONTEND_URL
# from routers.crud import  get_crud_router
# from routers.knowledge_graph import  get_crud_router_kg
from logger import setup_logger
logger = setup_logger(__name__)

from fastapi import FastAPI
from contextlib import asynccontextmanager
from routers.notify import bot, TOKEN

app = FastAPI(host="0.0.0.0", port=8000)

app.include_router(ping.router, tags=["ping"])
app.include_router(knowledge_graph.router, prefix=f"/knowledge-graph", tags=[f"knowledge-graph"])
app.include_router(embeddings_router.router, prefix="/embeddings", tags=["embeddings"]) 
app.include_router(notify.router, prefix="/notify", tags=["notify"])

origins = [
    FRONTEND_URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # or specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
