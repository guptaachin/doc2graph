import time
from typing import Optional
from langchain_neo4j import Neo4jGraph
import environment


def get_neo4j_connection(
    max_retries: int = 20,
    delay_seconds: float = 1.0,
    connect_timeout: float = 5.0,
) -> Neo4jGraph:
    """Create a Neo4jGraph with retries. Supports local or remote via env.

    Env variables:
    - NEO4J_URI, NEO4J_USER, NEO4J_PASS
    """
    uri = environment.NEO4J_URI
    user = environment.NEO4J_USER
    pw = environment.NEO4J_PASS

    last_err: Optional[Exception] = None
    for attempt in range(1, max_retries + 1):
        try:
            graph = Neo4jGraph(url=uri, username=user, password=pw)
            # Simple test query
            graph.query("RETURN 1 AS ok")
            return graph
        except Exception as e:
            last_err = e
            time.sleep(delay_seconds)
    raise RuntimeError(f"Failed to connect to Neo4j after {max_retries} retries: {last_err}")


