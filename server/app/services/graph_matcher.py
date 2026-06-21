import json
import os
from typing import Optional
from llama_index.graph_stores.kuzu import KuzuGraphStore
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.core.vector_stores import VectorStoreQuery
from llama_index.core.schema import TextNode, RelationshipType
from app.core.config import get_settings

settings = get_settings()


class GraphMatcher:
    """
    Handles matching contract clauses against regulation graph.
    Uses Kuzu for graph traversal and ChromaDB for vector search.
    """

    def __init__(self):
        self._graph_store: Optional[KuzuGraphStore] = None
        self._vector_store: Optional[ChromaVectorStore] = None
        self._initialized = False

    def initialize(self):
        """Lazy initialization of stores"""
        if self._initialized:
            return

        os.makedirs(settings.chroma_db_path, exist_ok=True)
        os.makedirs(os.path.dirname(settings.kuzu_db_path), exist_ok=True)

        # Initialize Kuzu graph store
        self._graph_store = KuzuGraphStore(
            db_path=settings.kuzu_db_path
        )

        # Initialize ChromaDB vector store
        import chromadb
        chroma_client = chromadb.PersistentClient(path=settings.chroma_db_path)
        self._vector_store = ChromaVectorStore(chroma_client=chroma_client)

        self._initialized = True

    def find_relevant_pasal(self, clause_text: str, top_k: int = 5) -> list[dict]:
        """
        Find relevant pasal from reference graph for a contract clause.
        Uses vector similarity search first, then graph traversal for context.
        """
        if not self._initialized:
            self.initialize()

        # Vector search to find similar clauses in regulations
        query_embedding = self._get_embedding(clause_text)
        if query_embedding is None:
            return []

        results = self._vector_store.query(
            query_embedding=query_embedding,
            similarity_top_k=top_k,
        )

        relevant_pasal = []
        if results and results.ids:
            for i, node_id in enumerate(results.ids[0]) if isinstance(results.ids[0], list) else [results.ids]:
                score = results.scores[0][i] if i < len(results.scores[0]) else 0
                if score > 0.7:
                    # Get node from graph store
                    pasal_data = self._get_pasal_from_graph(node_id)
                    if pasal_data:
                        relevant_pasal.append({
                            "pasal_id": node_id,
                            "score": float(score),
                            **pasal_data
                        })

        return relevant_pasal

    def _get_embedding(self, text: str) -> Optional[list[float]]:
        """Get embedding for text using OpenAI"""
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.openai_api_key)
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=text
            )
            return response.data[0].embedding
        except Exception:
            return None

    def _get_pasal_from_graph(self, node_id: str) -> Optional[dict]:
        """Retrieve pasal data from Kuzu graph"""
        if not self._graph_store:
            return None

        try:
            # Query for node properties
            query = f"""
            MATCH (p:Pasal {{id: '{node_id}'}})
            RETURN p.id as id, p.nomor as nomor, p.teks as teks,
                   p.status as status, p.regulation as regulation
            """
            result = self._graph_store.query(query)
            if result and len(result) > 0:
                return result[0]
        except Exception:
            pass
        return None

    def get_all_pasal(self, regulation: Optional[str] = None) -> list[dict]:
        """Get all pasal nodes, optionally filtered by regulation"""
        if not self._initialized:
            self.initialize()

        if not self._graph_store:
            return []

        try:
            if regulation:
                query = f"""
                MATCH (p:Pasal {{regulation: '{regulation}'}})
                RETURN p.id as id, p.nomor as nomor, p.teks as teks,
                       p.status as status, p.regulation as regulation
                ORDER BY p.nomor
                """
            else:
                query = """
                MATCH (p:Pasal)
                RETURN p.id as id, p.nomor as nomor, p.teks as teks,
                       p.status as status, p.regulation as regulation
                ORDER BY p.regulation, p.nomor
                """
            return self._graph_store.query(query) or []
        except Exception:
            return []

    def get_graph_data(self) -> dict:
        """Export full graph for visualization"""
        if not self._initialized:
            self.initialize()

        if not self._graph_store:
            return {"nodes": [], "edges": []}

        nodes = []
        edges = []

        try:
            # Get all nodes
            node_query = """
            MATCH (p:Pasal)
            RETURN p.id as id, p.nomor as nomor, p.teks as teks,
                   p.status as status, p.regulation as regulation
            """
            for row in self._graph_store.query(node_query) or []:
                nodes.append({
                    "id": row.get("id", ""),
                    "label": f"Pasal {row.get('nomor', '')}",
                    "type": "pasal",
                    "status": row.get("status", "aktif"),
                    "regulation": row.get("regulation", ""),
                    "teks": row.get("teks", "")[:100],
                })

            # Get all relationships
            rel_query = """
            MATCH (p1:Pasal)-[r:REFERENCES|SUPPORTED_BY]->(p2:Pasal)
            RETURN p1.id as source, p2.id as target, type(r) as relation
            """
            for row in self._graph_store.query(rel_query) or []:
                edges.append({
                    "source": row.get("source", ""),
                    "target": row.get("target", ""),
                    "relation": row.get("relation", ""),
                })
        except Exception:
            pass

        return {"nodes": nodes, "edges": edges}
