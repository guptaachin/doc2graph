import os
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_neo4j import Neo4jGraph
from langchain_community.vectorstores import Neo4jVector
from langchain_openai import OpenAIEmbeddings
from langchain.chains import RetrievalQAWithSourcesChain
from langchain_openai import ChatOpenAI
from environment import NEO4J_URI, NEO4J_USER, NEO4J_PASS
from database.neo import get_neo4j_connection
import logging
from tqdm import tqdm
from utils.extract_text_from_pdf import extract_text_from_pdf
from utils.extract_text_from_image import extract_text_from_image


# Set up logging with minimal verbosity
logging.basicConfig(level=logging.ERROR)
# Suppress all HTTP logs
logging.getLogger("openai").setLevel(logging.ERROR)
logging.getLogger("httpx").setLevel(logging.ERROR)
logging.getLogger("httpcore").setLevel(logging.ERROR)
logging.getLogger("neo4j").setLevel(logging.ERROR)

logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)

# Constants
VECTOR_INDEX_NAME = 'pdf_chunks'
VECTOR_NODE_LABEL = 'Chunk'
VECTOR_SOURCE_PROPERTY = 'text'
VECTOR_EMBEDDING_PROPERTY = 'textEmbedding'



# Initialize Neo4j connection with retries and env switching
kg = get_neo4j_connection()



def ensure_constraints():
    """Create necessary unique constraints once"""
    constraints = {
        "unique_user": "CREATE CONSTRAINT unique_user IF NOT EXISTS FOR (u:User) REQUIRE u.user_id IS UNIQUE",
        "unique_chunk": "CREATE CONSTRAINT unique_chunk IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE"
    }
    for name, query in constraints.items():
        try:
            kg.query(query)
        except Exception:
            pass  # Constraint already exists

def split_text(text, chunk_size=2000, chunk_overlap=400):
    """Split text into intelligently sized chunks"""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""],
        length_function=len
    )
    return splitter.split_text(text)



def create_or_get_user(user_id, name=None, email=None):
    ensure_constraints()
    kg.query("""
        MERGE (u:User {user_id: $user_id})
        SET u.name = COALESCE($name, u.name),
            u.email = COALESCE($email, u.email),
            u.created_date = COALESCE(u.created_date, datetime()),
            u.last_activity = datetime()
    """, params={'user_id': user_id, 'name': name, 'email': email})
    return user_id

def remove_existing_file_nodes(filename, user_id):
    """Clear existing data only for a specific user's file and its relationships"""
    try:
        # Clear chunks and file node with all relationships for specific user
        kg.query("""
            MATCH (u:User {user_id: $user_id})-[:UPLOADED]->(f:File {filename: $filename})
            OPTIONAL MATCH (f)-[:HAS_CHUNK]->(c:Chunk)
            DETACH DELETE f, c
        """, params={'filename': filename, 'user_id': user_id})
    except Exception as e:
        print(f"Error clearing existing data for {filename}: {e}")
        exit(1)

def _delete_file_or_chunks(filename=None, user_id=None):
    """Generic deletion of a file and/or its chunks for a user"""
    if not filename and not user_id:
        return
    params = {'filename': filename, 'user_id': user_id}
    query = """
        MATCH (u:User {user_id: $user_id})
        OPTIONAL MATCH (u)-[:UPLOADED]->(f:File {filename: $filename})
        OPTIONAL MATCH (f)-[:HAS_CHUNK]->(c:Chunk)
        DETACH DELETE f, c
    """
    kg.query(query, params=params)



def delete_user(user_id):
    """Delete a user and all associated files/chunks"""
    try:
        result = kg.query("""
            MATCH (u:User {user_id: $user_id})
            OPTIONAL MATCH (u)-[:UPLOADED]->(f:File)
            OPTIONAL MATCH (f)-[:HAS_CHUNK]->(c:Chunk)
            RETURN u.user_id AS user_id, u.name AS name,
                   COUNT(DISTINCT f) AS total_files,
                   COUNT(DISTINCT c) AS total_chunks
        """, params={'user_id': user_id})
        if not result or not result[0]['user_id']:
            print(f"User '{user_id}' not found")
            return False
        _delete_file_or_chunks(user_id=user_id)
        info = result[0]
        print(f"Deleted user '{user_id}' ({info['name'] or 'No name'}), "
              f"{info['total_files']} files, {info['total_chunks']} chunks")
        return True
    except Exception as e:
        print(f"Error deleting user {user_id}: {e}")
        return False


def delete_file_knowledge_graph(filename, user_id):
    """Delete a specific file and all its associated data for a user"""
    try:
        # Check if file exists for this user
        result = kg.query("""
            MATCH (u:User {user_id: $user_id})-[:UPLOADED]->(f:File {filename: $filename})
            RETURN f.filename AS filename, f.total_chunks AS chunks
        """, params={'filename': filename, 'user_id': user_id})

        if not result:
            print(f"File '{filename}' not found for user '{user_id}'")
            return False

        file_info = result[0]

        # Delete file and all its chunks with relationships
        kg.query("""
            MATCH (u:User {user_id: $user_id})-[:UPLOADED]->(f:File {filename: $filename})
            OPTIONAL MATCH (f)-[:HAS_CHUNK]->(c:Chunk)
            DETACH DELETE f, c
        """, params={'filename': filename, 'user_id': user_id})

        print(f"Successfully deleted file '{filename}' and {file_info['chunks']} chunks for user '{user_id}'")
        return True

    except Exception as e:
        print(f"Error deleting file {filename} for user {user_id}: {e}")
        return False

def create_or_update_file_node(filename, user_id, chunks, metadata):
    """Create or update File node and its relationship with the user"""
    ensure_constraints()
    params = {
        'user_id': user_id, 'filename': filename, 'source': filename,
        'total_chunks': len(chunks), 'metadata': metadata
    }
    kg.query("""
        MERGE (f:File {user_id: $user_id, filename: $filename})
        SET f.source = $source,
            f.processed_date = datetime(),
            f.total_chunks = $total_chunks,
            f.pages_processed = $metadata.pages_processed,
            f.images_processed = $metadata.images_processed,
            f.successful_ocr = $metadata.successful_ocr,
            f.failed_ocr = $metadata.failed_ocr,
            f.extraction_errors = $metadata.extraction_errors
    """, params=params)
    kg.query("""
        MATCH (u:User {user_id: $user_id})
        MATCH (f:File {user_id: $user_id, filename: $filename})
        MERGE (u)-[:UPLOADED]->(f)
    """, params={'user_id': user_id, 'filename': filename})
    # Remove existing chunks
    kg.query("""
        MATCH (f:File {user_id: $user_id, filename: $filename})-[:HAS_CHUNK]->(c:Chunk)
        DETACH DELETE c
    """, params={'user_id': user_id, 'filename': filename})


def store_chunks(chunks, filename, user_id):
    batch_size = 50
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i+batch_size]
        params = [{
            'id': f'{user_id}_{filename}_chunk_{i+j}',
            'text': chunk,
            'chunk_index': i+j,
            'section': f'{user_id}_{filename}_section_{(i+j)//10}',
            'length': len(chunk),
            'user_id': user_id,
            'filename': filename
        } for j, chunk in enumerate(batch)]
        kg.query("""
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
        """, params={'params': params, 'user_id': user_id, 'filename': filename})


def _process_text_file(text, filename, user_id, metadata):
    """Handles splitting text, storing chunks, creating relationships, embeddings"""
    chunks = split_text(text)
    create_or_update_file_node(filename, user_id, chunks, metadata)
    store_chunks(chunks, filename, user_id)
    create_chunk_relationships(filename)
    create_vector_index_and_embeddings(filename)
    return len(chunks)


def create_chunk_relationships(filename=None):
    query = """
        MATCH (f:File{filename:$filename})-[:HAS_CHUNK]->(c1:Chunk),
              (f)-[:HAS_CHUNK]->(c2:Chunk)
        WHERE c1.chunk_index = c2.chunk_index - 1
        MERGE (c1)-[:NEXT]->(c2)
    """ if filename else """
        MATCH (f:File)-[:HAS_CHUNK]->(c1:Chunk),
              (f)-[:HAS_CHUNK]->(c2:Chunk)
        WHERE c1.chunk_index = c2.chunk_index - 1
        MERGE (c1)-[:NEXT]->(c2)
    """
    kg.query(query, params={'filename': filename} if filename else {})


def create_graph_and_store_chunks(chunks, filename, user_id, extraction_metadata):
    try:
        # Create constraints (suppress notifications)
        try:
            kg.query("CREATE CONSTRAINT unique_chunk IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE")
        except Exception:
            pass  # Constraint already exists

        # Create or update File node with user_id
        kg.query("""
            MERGE (f:File {user_id: $user_id, filename: $filename})
            ON CREATE SET 
                f.source = $source,
                f.processed_date = datetime(),
                f.total_chunks = $total_chunks,
                f.pages_processed = $metadata.pages_processed,
                f.images_processed = $metadata.images_processed,
                f.successful_ocr = $metadata.successful_ocr,
                f.failed_ocr = $metadata.failed_ocr,
                f.extraction_errors = $metadata.extraction_errors
            ON MATCH SET
                f.source = $source,
                f.processed_date = datetime(),
                f.total_chunks = $total_chunks,
                f.pages_processed = $metadata.pages_processed,
                f.images_processed = $metadata.images_processed,
                f.successful_ocr = $metadata.successful_ocr,
                f.failed_ocr = $metadata.failed_ocr,
                f.extraction_errors = $metadata.extraction_errors
        """, params={
            'user_id': user_id,
            'filename': filename,
            'source': filename,
            'total_chunks': len(chunks),
            'metadata': extraction_metadata
        })


        # Create User-UPLOADED->File relationship
        kg.query("""
            MATCH (u:User {user_id: $user_id})
            MATCH (f:File {user_id: $user_id, filename: $filename})
            MERGE (u)-[:UPLOADED]->(f)
        """, params={'user_id': user_id, 'filename': filename})
        # Delete existing chunks for this file (if any)
        kg.query("""
            MATCH (f:File {user_id: $user_id, filename: $filename})-[:HAS_CHUNK]->(c:Chunk)
            DETACH DELETE c
        """, params={'user_id': user_id, 'filename': filename})

        batch_size = 50
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i+batch_size]
            # Enhanced metadata with user and filename-based IDs
            params = [{
                'id': f'{user_id}_{filename}_chunk_{i+j}',
                'text': chunk,
                'chunk_index': i+j,
                'section': f'{user_id}_{filename}_section_{(i+j) // 10}',
                'length': len(chunk),
                'user_id': user_id,
                'filename': filename
            } for j, chunk in enumerate(batch)]

            # Create chunks and establish relationships with File node
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
                params={'params': params, 'user_id': user_id, 'filename': filename}
            )

        print(f"Stored {len(chunks)} chunks for {filename}")
    except Exception as e:
        print(f"Error creating graph and storing chunks: {e}")
        raise  # Re-raise the exception to be caught in the calling function

def create_chunk_relationships(filename=None):
    """Create NEXT relationships between sequential chunks in the same file"""
    try:
        if filename:
            query = """
            MATCH (f:File {filename: $filename})-[:HAS_CHUNK]->(c1:Chunk)
            MATCH (f)-[:HAS_CHUNK]->(c2:Chunk)
            WHERE c1.chunk_index = c2.chunk_index - 1
            MERGE (c1)-[:NEXT]->(c2)
            """
            kg.query(query, params={'filename': filename})
        else:
            query = """
            MATCH (f:File)-[:HAS_CHUNK]->(c1:Chunk)
            MATCH (f)-[:HAS_CHUNK]->(c2:Chunk)
            WHERE c1.chunk_index = c2.chunk_index - 1
            MERGE (c1)-[:NEXT]->(c2)
            """
            kg.query(query)
    except Exception as e:
        print(f"Error creating chunk relationships: {e}")

def create_vector_index_and_embeddings(filename=None):
    try:
        kg.query(f"""
        CREATE VECTOR INDEX {VECTOR_INDEX_NAME} IF NOT EXISTS
        FOR (c:{VECTOR_NODE_LABEL}) ON (c.{VECTOR_EMBEDDING_PROPERTY})
        OPTIONS {{
            indexConfig: {{
                `vector.dimensions`: 1536,
                `vector.similarity_function`: 'cosine'
            }}
        }}
        """)

        embeddings = OpenAIEmbeddings()
        # Only process chunks for specific file if filename provided, otherwise all chunks
        if filename:
            chunks = kg.query("""
                MATCH (f:File {filename: $filename})-[:HAS_CHUNK]->(c:Chunk)
                WHERE c.textEmbedding IS NULL 
                RETURN c.id AS id, c.text AS text, f.filename AS filename
            """, params={'filename': filename})
        else:
            chunks = kg.query("""
                MATCH (f:File)-[:HAS_CHUNK]->(c:Chunk)
                WHERE c.textEmbedding IS NULL 
                RETURN c.id AS id, c.text AS text, f.filename AS filename
            """)

        for chunk in tqdm(chunks, desc="Generating embedding", unit="chunk"):
            embedding_vector = embeddings.embed_query(chunk['text'])
            kg.query(
                "MATCH (c:Chunk {id: $id}) SET c.textEmbedding = $embedding",
                params={'id': chunk['id'], 'embedding': embedding_vector}
            )

        if filename:
            print(f"Vector index and embeddings created/updated successfully for {filename}")
        else:
            print("Vector index and embeddings created/updated successfully for all files")
    except Exception as e:
        print(f"Error creating vector index and embeddings: {e}")
        exit(1)

def visualize_graph_structure():
    files_info = kg.query("""
        MATCH (f:File)
        OPTIONAL MATCH (f)-[:HAS_CHUNK]->(c:Chunk)
        RETURN f.filename AS filename, 
               f.source AS source,
               f.processed_date AS processed_date,
               f.total_chunks AS total_chunks,
               count(c) AS actual_chunks,
               f.pages_processed AS pages,
               f.images_processed AS images,
               f.successful_ocr AS ocr_success,
               f.failed_ocr AS ocr_failed
        ORDER BY f.filename
    """)

    print("\n=== GRAPH STRUCTURE ===")
    for file_info in files_info:
        print(f"\nFile: {file_info['filename']}")
        print(f"  Source: {file_info['source']}")
        print(f"  Processed: {file_info['processed_date']}")
        print(f"  Pages: {file_info['pages']}")
        print(f"  Images: {file_info['images']}")
        print(f"  OCR Success/Failed: {file_info['ocr_success']}/{file_info['ocr_failed']}")
        print(f"  Chunks: {file_info['actual_chunks']}/{file_info['total_chunks']}")

def setup_qa_system(user_id, filenames=None):
    try:
        # Build filename filter for the query
        if filenames:
            filenames_str = ', '.join([f'"{f}"' for f in filenames])
            file_filter = f"AND f.filename IN [{filenames_str}]"
        else:
            file_filter = ""

        # Enhanced retrieval query with user-based access control (direct substitution)
        retrieval_query = f"""
        MATCH (u:User {{user_id: '{user_id}'}})-[:UPLOADED]->(f:File)-[:HAS_CHUNK]->(c:Chunk)
        WHERE c.textEmbedding IS NOT NULL {file_filter}
        WITH f, c, gds.similarity.cosine(c.textEmbedding, $embedding) AS score

        // Get the main chunks based on similarity
        WITH f, c, score WHERE score > 0.7
        ORDER BY score DESC
        LIMIT 5

        // Get surrounding context for each chunk from the same file and section
        MATCH (f)-[:HAS_CHUNK]->(context:Chunk)
        WHERE context.section = c.section

        WITH f, c, score, 
             COLLECT(DISTINCT context.text) as contextTexts

        RETURN 
            c.text + '\\n\\n' + apoc.text.join(contextTexts, ' ') AS text,
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

        # Create vector store with user-scoped retrieval query
        vector_store = Neo4jVector.from_existing_index(
            embedding=OpenAIEmbeddings(),
            url=NEO4J_URI,
            username=NEO4J_USER,
            password=NEO4J_PASS,
            index_name=VECTOR_INDEX_NAME,
            text_node_property=VECTOR_SOURCE_PROPERTY,
            retrieval_query=retrieval_query)

        retriever = vector_store.as_retriever(search_kwargs={
            "k": 5,
            "score_threshold": 0.7
        })

        return RetrievalQAWithSourcesChain.from_chain_type(
            ChatOpenAI(temperature=0),
            chain_type="stuff",
            retriever=retriever,
            return_source_documents=True)
    except Exception as e:
        print(f"Error setting up QA system for user {user_id}: {e}")
        raise

def process_and_store_pdf(pdf_path, user_id):
    """Complete workflow to process a PDF file and store it in Neo4j with proper graph relationships"""
    filename = os.path.basename(pdf_path)

    logger.info(f"Starting PDF processing for user {user_id}, file: {filename}")

    # Clear existing data for this user's file
    remove_existing_file_nodes(filename, user_id)

    # Extract and clean text
    try:
        pdf_text, extraction_stats = extract_text_from_pdf(
            pdf_path,
            languages=['eng']  # Add more languages if needed, e.g., ['eng', 'fra', 'deu']
        )

        # Store extraction statistics in the File node
        extraction_metadata = {
            'pages_processed': extraction_stats['total_pages'],
            'images_processed': extraction_stats['total_images'],
            'successful_ocr': extraction_stats['successful_ocr'],
            'failed_ocr': extraction_stats['failed_ocr'],
            'extraction_errors': len(extraction_stats['errors'])
        }

        logger.info("PDF text extracted and cleaned successfully")

        # Split into chunks
        chunks = split_text(pdf_text)
        logger.info(f"Created {len(chunks)} text chunks")

        # Create graph structure with relationships
        create_graph_and_store_chunks(chunks, filename, user_id, extraction_metadata)

        # Create sequential chunk relationships
        create_chunk_relationships(filename)

        # Create embeddings
        create_vector_index_and_embeddings(filename)

        logger.info(f"Successfully processed {user_id}/{filename}")
        return filename

    except Exception as e:
        logger.error(f"Error processing PDF {filename}: {str(e)}")
        raise

def ask_question(user_id: str, question: str, filenames: list = None):
    """
    Ask a question against user's knowledge graph
    Args:
        user_id: User identifier 
        question: Question to ask
        filenames: List of specific filenames to search in (optional)
    Returns:
        dict: QA response with answer and source information
    """
    try:
        # Setup QA system for the user
        qa_chain = setup_qa_system(user_id, filenames)
        
        # Get response from QA chain
        response = qa_chain.invoke({"question": question})
        
        # Extract source information
        sources = []
        for doc in response.get('source_documents', []):
            source_info = {
                'filename': doc.metadata.get('filename', 'Unknown'),
                'user_id': doc.metadata.get('user_id', 'Unknown'), 
                'section': doc.metadata.get('section', 'Unknown'),
                'chunk_index': doc.metadata.get('chunk_index', 'Unknown'),
                'chunk_id': doc.metadata.get('id', 'Unknown')
            }
            sources.append(source_info)
        
        return {
            "status": "success",
            "answer": response.get('answer', ''),
            "question": question,
            "sources": sources,
            "total_sources": len(sources)
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Error processing question: {str(e)}",
            "error": str(e)
        }

def create_file_knowledge_graph(user_id, filename, file_contents, content_type=None):
    try:
        create_or_get_user(user_id)

        text, file_type = None, None


        # PDF
        if filename.lower().endswith('.pdf') or (content_type and 'pdf' in content_type.lower()):
            temp_pdf_path = f"/tmp/{filename}"
            with open(temp_pdf_path, 'wb') as f:
                f.write(file_contents)
            try:
                pdf_text, stats = extract_text_from_pdf(temp_pdf_path, languages=['eng'])
                metadata = {
                    'pages_processed': stats['total_pages'],
                    'images_processed': stats['total_images'],
                    'successful_ocr': stats['successful_ocr'],
                    'failed_ocr': stats['failed_ocr'],
                    'extraction_errors': len(stats['errors'])
                }
                chunks_count = _process_text_file(pdf_text, filename, user_id, metadata)
                os.remove(temp_pdf_path)
                return {"status": "success", "processed_filename": filename, "chunks": chunks_count, "file_type": "pdf"}
            except Exception as e:
                if os.path.exists(temp_pdf_path):
                    os.remove(temp_pdf_path)
                raise e

        # Image
        elif filename.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif')) or (content_type and 'image' in content_type.lower()):
            text = extract_text_from_image(file_contents)
            metadata = {
                'pages_processed': 1,
                'images_processed': 1,
                'successful_ocr': 1 if text else 0,
                'failed_ocr': 0 if text else 1,
                'extraction_errors': 0
            }
            chunks_count = _process_text_file(text, filename, user_id, metadata)
            return {"status": "success", "processed_filename": filename, "chunks": chunks_count, "file_type": "image"}
        # Text or other files → decode as UTF-8
        else:
            try:
                text = file_contents.decode('utf-8')
                metadata = {
                    'pages_processed': 1,
                    'images_processed': 0,
                    'successful_ocr': 1,
                    'failed_ocr': 0,
                    'extraction_errors': 0
                }
                file_type = "text"
            except Exception:
                # Cannot decode → register unprocessed
                text = None
                file_type = "other"
                metadata = None

        # If text was successfully extracted, process normally
        if text:
            chunks_count = _process_text_file(text, filename, user_id, metadata)
            return {"status": "success", "processed_filename": filename, "chunks": chunks_count, "file_type": file_type}
        else:
            # File could not be converted to text, just register
            return {"status": "success", "message": f"File '{filename}' registered (unprocessed)", "file_type": file_type}

    except Exception as e:
        return {"status": "error", "message": f"Error processing file '{filename}': {str(e)}", "error": str(e)}