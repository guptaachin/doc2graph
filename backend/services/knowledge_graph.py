from __future__ import annotations

import os
import re
from typing import Any, Dict, List

import httpx
from database.neo import get_neo4j_connection
from environment import NEO4J_URI, NEO4J_USER, NEO4J_PASS
from langchain.chains import RetrievalQAWithSourcesChain
from langchain_community.vectorstores import Neo4jVector
from langchain_openai import ChatOpenAI
from langchain_ollama import ChatOllama
import environment
from services.embeddings import get_embeddings, embed_text, embedding_dimension
from utils.extract_text_from_image import extract_text_from_image
from utils.extract_text_from_pdf import extract_text_from_pdf


kg = get_neo4j_connection()
MAX_TOTAL_BYTES: int = 100 * 1024 * 1024  # 100 MB


def list_files(user_id: str) -> List[Dict[str, Any]]:
    result = kg.query(
        """
        MATCH (u:User {user_id: $user_id})-[:UPLOADED]->(f:File)
        RETURN f.filename AS filename,
               f.total_chunks AS total_chunks,
               f.processed_date AS processed_date
        ORDER BY f.filename
        """,
        params={"user_id": user_id},
    )
    return [
        {
            "filename": r.get("filename"),
            "total_chunks": r.get("total_chunks"),
            "processed_date": r.get("processed_date"),
        }
        for r in (result or [])
    ]


def ingest_text_file(user_id: str, filename: str, contents: bytes) -> Dict[str, Any]:
    if not filename.lower().endswith(".txt"):
        raise ValueError("Only .txt files are supported")
    if len(contents) > MAX_TOTAL_BYTES:
        raise ValueError("Total size exceeds 100 MB limit")
    return _create_file_knowledge_graph(user_id, filename, contents, content_type="text/plain")


def _strip_html(html: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


async def ingest_url(user_id: str, url: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(url, follow_redirects=True)
        resp.raise_for_status()
        content_bytes = resp.content
        if len(content_bytes) > MAX_TOTAL_BYTES:
            raise ValueError("Total size exceeds 100 MB limit")
        try:
            text = content_bytes.decode("utf-8", errors="ignore")
        except Exception:
            text = content_bytes.decode(errors="ignore")
        plain = _strip_html(text)
        return _create_file_knowledge_graph(
            user_id=user_id,
            filename=url,
            file_contents=plain.encode("utf-8"),
            content_type="text/plain",
        )


def get_graph(user_id: str) -> Dict[str, Any]:
    # Enhanced query to get more detailed node information
    data = kg.query(
        """
        MATCH (u:User {user_id: $user_id})-[:UPLOADED]->(f:File)
        OPTIONAL MATCH (f)-[:HAS_CHUNK]->(c:Chunk)
        RETURN f.filename AS filename, 
               f.file_type AS file_type,
               f.size AS file_size,
               f.processed_date AS processed_date,
               collect({
                   id: c.id, 
                   idx: c.chunk_index,
                   text: substring(c.text, 0, 100),
                   text_length: size(c.text),
                   section: c.section
               }) AS chunks
        """,
        params={"user_id": user_id},
    )
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    for row in data or []:
        file_id = f"file::{row['filename']}"
        
        # Enhanced file node with metadata
        file_node = {
            "id": file_id, 
            "label": row["filename"], 
            "type": "file",
            "properties": {
                "filename": row["filename"],
                "file_type": row.get("file_type", "unknown"),
                "file_size": row.get("file_size"),
                "processed_date": str(row.get("processed_date", "")),
                "chunk_count": len([ch for ch in row.get("chunks", []) if ch and ch.get("id")])
            }
        }
        nodes.append(file_node)
        
        for ch in row.get("chunks", []) or []:
            if not ch or ch.get("id") is None:
                continue
            chunk_id = ch["id"]
            
            # Enhanced chunk node with metadata
            chunk_node = {
                "id": chunk_id, 
                "label": str(ch.get("idx", "")), 
                "type": "chunk",
                "properties": {
                    "chunk_index": ch.get("idx", 0),
                    "text_preview": ch.get("text", "")[:100] + ("..." if len(ch.get("text", "")) > 100 else ""),
                    "text_length": ch.get("text_length", 0),
                    "section": ch.get("section", ""),
                    "parent_file": row["filename"]
                }
            }
            nodes.append(chunk_node)
            
            # Enhanced edge with metadata
            edge = {
                "source": file_id, 
                "target": chunk_id, 
                "type": "HAS_CHUNK",
                "properties": {
                    "relationship": "contains",
                    "chunk_order": ch.get("idx", 0)
                }
            }
            edges.append(edge)

    # Enhanced next relationships query
    next_rows = kg.query(
        """
        MATCH (c1:Chunk)-[:NEXT]->(c2:Chunk)
        RETURN c1.id AS source, 
               c2.id AS target,
               c1.chunk_index AS source_idx,
               c2.chunk_index AS target_idx
        """
    )
    for r in next_rows or []:
        if r.get("source") and r.get("target"):
            edge = {
                "source": r["source"], 
                "target": r["target"], 
                "type": "NEXT",
                "properties": {
                    "relationship": "sequence",
                    "source_index": r.get("source_idx", 0),
                    "target_index": r.get("target_idx", 0)
                }
            }
            edges.append(edge)

    # Get additional graph statistics
    stats = kg.query(
        """
        MATCH (u:User {user_id: $user_id})
        OPTIONAL MATCH (u)-[:UPLOADED]->(f:File)
        OPTIONAL MATCH (f)-[:HAS_CHUNK]->(c:Chunk)
        RETURN count(DISTINCT f) AS file_count,
               count(DISTINCT c) AS chunk_count,
               sum(f.size) AS total_size
        """,
        params={"user_id": user_id}
    )
    
    graph_stats = {}
    if stats:
        stat_row = stats[0]
        graph_stats = {
            "file_count": stat_row.get("file_count", 0),
            "chunk_count": stat_row.get("chunk_count", 0),
            "total_size": stat_row.get("total_size", 0)
        }

    unique_nodes = {n["id"]: n for n in nodes}.values()
    return {
        "nodes": list(unique_nodes), 
        "edges": edges,
        "statistics": graph_stats,
        "user_id": user_id
    }


def health() -> Dict[str, Any]:
    return {"ok": kg.query("RETURN 1 AS ok")}


def _ensure_constraints():
    constraints = {
        "unique_user": "CREATE CONSTRAINT unique_user IF NOT EXISTS FOR (u:User) REQUIRE u.user_id IS UNIQUE",
        "unique_chunk": "CREATE CONSTRAINT unique_chunk IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE",
    }
    for _, query in constraints.items():
        try:
            kg.query(query)
        except Exception:
            pass


def _split_text(text: str, chunk_size: int = 2000, chunk_overlap: int = 400) -> List[str]:
    from langchain.text_splitter import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""],
        length_function=len,
    )
    return splitter.split_text(text)


def _create_or_get_user(user_id: str, name: str | None = None, email: str | None = None) -> str:
    _ensure_constraints()
    kg.query(
        """
        MERGE (u:User {user_id: $user_id})
        SET u.name = COALESCE($name, u.name),
            u.email = COALESCE($email, u.email),
            u.created_date = COALESCE(u.created_date, datetime()),
            u.last_activity = datetime()
        """,
        params={"user_id": user_id, "name": name, "email": email},
    )
    return user_id


def _create_or_update_file_node(filename: str, user_id: str, chunks: List[str], metadata: Dict[str, Any]):
    _ensure_constraints()
    kg.query(
        """
        MERGE (f:File {user_id: $user_id, filename: $filename})
        SET f.source = $source,
            f.processed_date = datetime(),
            f.total_chunks = $total_chunks,
            f.pages_processed = $metadata.pages_processed,
            f.images_processed = $metadata.images_processed,
            f.successful_ocr = $metadata.successful_ocr,
            f.failed_ocr = $metadata.failed_ocr,
            f.extraction_errors = $metadata.extraction_errors
        """,
        params={
            "user_id": user_id,
            "filename": filename,
            "source": filename,
            "total_chunks": len(chunks),
            "metadata": metadata,
        },
    )
    kg.query(
        """
        MATCH (u:User {user_id: $user_id})
        MATCH (f:File {user_id: $user_id, filename: $filename})
        MERGE (u)-[:UPLOADED]->(f)
        """,
        params={"user_id": user_id, "filename": filename},
    )
    kg.query(
        """
        MATCH (f:File {user_id: $user_id, filename: $filename})-[:HAS_CHUNK]->(c:Chunk)
        DETACH DELETE c
        """,
        params={"user_id": user_id, "filename": filename},
    )


def _store_chunks(chunks: List[str], filename: str, user_id: str):
    batch_size = 50
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        params = [
            {
                "id": f"{user_id}_{filename}_chunk_{i+j}",
                "text": chunk,
                "chunk_index": i + j,
                "section": f"{user_id}_{filename}_section_{(i+j)//10}",
                "length": len(chunk),
                "user_id": user_id,
                "filename": filename,
            }
            for j, chunk in enumerate(batch)
        ]
        kg.query(
            """
            MATCH (f:File {user_id: $user_id, filename: $filename})
            UNWIND $params AS param
            CREATE (c:Chunk {id: param.id})
            SET c.text = param.text,
                c.chunk_index = param.chunk_index,
                c.section = param.section,
                c.length = param.length,
                c.user_id = param.user_id,
                c.filename = param.filename
            MERGE (f)-[:HAS_CHUNK]->(c)
            """,
            params={"params": params, "user_id": user_id, "filename": filename},
        )


def _create_chunk_relationships(filename: str | None = None):
    if filename:
        query = """
        MATCH (f:File {filename: $filename})-[:HAS_CHUNK]->(c1:Chunk)
        MATCH (f)-[:HAS_CHUNK]->(c2:Chunk)
        WHERE c1.chunk_index = c2.chunk_index - 1
        MERGE (c1)-[:NEXT]->(c2)
        """
        kg.query(query, params={"filename": filename})
    else:
        query = """
        MATCH (f:File)-[:HAS_CHUNK]->(c1:Chunk)
        MATCH (f)-[:HAS_CHUNK]->(c2:Chunk)
        WHERE c1.chunk_index = c2.chunk_index - 1
        MERGE (c1)-[:NEXT]->(c2)
        """
        kg.query(query)


def _create_vector_index_and_embeddings(filename: str | None = None):
    dims = embedding_dimension()
    prop = f"textEmbedding{dims}"
    index_name = f"pdf_chunks_{dims}"
    kg.query(
        f"""
        CREATE VECTOR INDEX {index_name} IF NOT EXISTS
        FOR (c:Chunk) ON (c.{prop})
        OPTIONS {{
            indexConfig: {{
                `vector.dimensions`: $dims,
                `vector.similarity_function`: 'cosine'
            }}
        }}
        """,
        params={"dims": dims},
    )
    if filename:
        chunks = kg.query(
            f"""
            MATCH (f:File {{filename: $filename}})-[:HAS_CHUNK]->(c:Chunk)
            WHERE c.{prop} IS NULL 
            RETURN c.id AS id, c.text AS text, f.filename AS filename
            """,
            params={"filename": filename},
        )
    else:
        chunks = kg.query(
            f"""
            MATCH (f:File)-[:HAS_CHUNK]->(c:Chunk)
            WHERE c.{prop} IS NULL 
            RETURN c.id AS id, c.text AS text, f.filename AS filename
            """
        )
    for chunk in chunks:
        vec = embed_text(chunk["text"]) if chunk.get("text") else None
        if vec is None:
            continue
        kg.query(
            f"MATCH (c:Chunk {{id: $id}}) SET c.{prop} = $embedding",
            params={"id": chunk["id"], "embedding": vec},
        )


def _process_text_file(text: str, filename: str, user_id: str, metadata: Dict[str, Any]) -> int:
    chunks = _split_text(text)
    _create_or_update_file_node(filename, user_id, chunks, metadata)
    _store_chunks(chunks, filename, user_id)
    _create_chunk_relationships(filename)
    _create_vector_index_and_embeddings(filename)
    return len(chunks)


def _create_file_knowledge_graph(
    user_id: str, filename: str, file_contents: bytes, content_type: str | None = None
) -> Dict[str, Any]:
    try:
        _create_or_get_user(user_id)
        text: str | None = None
        file_type: str | None = None

        if filename.lower().endswith(".pdf") or (content_type and "pdf" in content_type.lower()):
            temp_pdf_path = f"/tmp/{filename}"
            with open(temp_pdf_path, "wb") as f:
                f.write(file_contents)
            try:
                pdf_text, stats = extract_text_from_pdf(temp_pdf_path, languages=["eng"])
                metadata = {
                    "pages_processed": stats["total_pages"],
                    "images_processed": stats["total_images"],
                    "successful_ocr": stats["successful_ocr"],
                    "failed_ocr": stats["failed_ocr"],
                    "extraction_errors": len(stats["errors"]),
                }
                chunks_count = _process_text_file(pdf_text, filename, user_id, metadata)
                os.remove(temp_pdf_path)
                return {"status": "success", "processed_filename": filename, "chunks": chunks_count, "file_type": "pdf"}
            except Exception as e:
                if os.path.exists(temp_pdf_path):
                    os.remove(temp_pdf_path)
                raise e
        elif filename.lower().endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".gif")) or (
            content_type and "image" in content_type.lower()
        ):
            text = extract_text_from_image(file_contents)
            metadata = {
                "pages_processed": 1,
                "images_processed": 1,
                "successful_ocr": 1 if text else 0,
                "failed_ocr": 0 if text else 1,
                "extraction_errors": 0,
            }
            chunks_count = _process_text_file(text or "", filename, user_id, metadata)
            return {"status": "success", "processed_filename": filename, "chunks": chunks_count, "file_type": "image"}
        else:
            try:
                text = file_contents.decode("utf-8")
                metadata = {
                    "pages_processed": 1,
                    "images_processed": 0,
                    "successful_ocr": 1,
                    "failed_ocr": 0,
                    "extraction_errors": 0,
                }
                file_type = "text"
            except Exception:
                text = None
                file_type = "other"
                metadata = None

        if text:
            chunks_count = _process_text_file(text, filename, user_id, metadata or {})
            return {"status": "success", "processed_filename": filename, "chunks": chunks_count, "file_type": file_type}
        else:
            return {"status": "success", "message": f"File '{filename}' registered (unprocessed)", "file_type": file_type}
    except Exception as e:
        return {"status": "error", "message": f"Error processing file '{filename}': {str(e)}", "error": str(e)}


def _build_retriever(user_id: str, filenames: List[str] | None):
    dims = embedding_dimension()
    prop = f"textEmbedding{dims}"
    index_name = f"pdf_chunks_{dims}"
    if filenames:
        filenames_str = ", ".join([f'"{f}"' for f in filenames])
        file_filter = f"AND f.filename IN [{filenames_str}]"
    else:
        file_filter = ""

    retrieval_query = f"""
    MATCH (u:User {{user_id: '{user_id}'}})-[:UPLOADED]->(f:File)-[:HAS_CHUNK]->(c:Chunk)
    WHERE c.{prop} IS NOT NULL {file_filter}
    WITH f, c, gds.similarity.cosine(c.{prop}, $embedding) AS score
    WITH f, c, score WHERE score > 0.7
    ORDER BY score DESC
    LIMIT 5
    MATCH (f)-[:HAS_CHUNK]->(context:Chunk)
    WHERE context.section = c.section
    WITH f, c, score, COLLECT(DISTINCT context.text) as contextTexts
    RETURN 
        c.text + '\n\n' + apoc.text.join(contextTexts, ' ') AS text,
        score,
        {{
            source: f.source,
            filename: f.filename,
            user_id: f.user_id,
            chunk_index: c.chunk_index,
            section: c.section,
            id: c.id
        }} AS metadata
    ORDER BY score DESC
    """

    vector_store = Neo4jVector.from_existing_index(
        embedding=get_embeddings(),
        url=NEO4J_URI,
        username=NEO4J_USER,
        password=NEO4J_PASS,
        index_name=index_name,
        text_node_property="text",
        retrieval_query=retrieval_query,
    )
    return vector_store.as_retriever(search_kwargs={"k": 5, "score_threshold": 0.7})


def ask_question(user_id: str, question: str, filenames: List[str] | None = None) -> Dict[str, Any]:
    retriever = _build_retriever(user_id, filenames)
    if environment.EMBEDDINGS_PROVIDER.strip().lower() == "ollama":
        if ChatOllama is None:
            raise RuntimeError("Ollama chat model not available in current environment")
        llm = ChatOllama(model=environment.OLLAMA_CHAT_MODEL, temperature=0, base_url=environment.OLLAMA_BASE_URL)
    else:
        llm = ChatOpenAI(temperature=0)
    qa_chain = RetrievalQAWithSourcesChain.from_chain_type(
        llm,
        chain_type="stuff",
        retriever=retriever,
        return_source_documents=True,
    )
    response = qa_chain.invoke({"question": question})

    sources: List[Dict[str, Any]] = []
    for doc in response.get("source_documents", []):
        sources.append(
            {
                "filename": doc.metadata.get("filename", "Unknown"),
                "user_id": doc.metadata.get("user_id", "Unknown"),
                "section": doc.metadata.get("section", "Unknown"),
                "chunk_index": doc.metadata.get("chunk_index", "Unknown"),
                "chunk_id": doc.metadata.get("id", "Unknown"),
            }
        )

    return {
        "status": "success",
        "answer": response.get("answer", ""),
        "question": question,
        "sources": sources,
        "total_sources": len(sources),
    }
