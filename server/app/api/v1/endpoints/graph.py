from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from app.models.schemas import GraphDataResponse
from app.core.dependencies import get_current_user
from app.services.graph_matcher import GraphMatcher

router = APIRouter(prefix="/graph", tags=["Graph Visualization"])

_graph_matcher: Optional[GraphMatcher] = None


def get_graph_matcher() -> GraphMatcher:
    global _graph_matcher
    if _graph_matcher is None:
        _graph_matcher = GraphMatcher()
    return _graph_matcher


@router.get("/data", response_model=GraphDataResponse)
async def get_graph_data(
    regulation: Optional[str] = Query(None, description="Filter by regulation (e.g., 'PP 35/2021')"),
    current_user: dict = Depends(get_current_user),
):
    """
    Get graph data for visualization.
    Returns nodes and edges for react-force-graph.
    """
    matcher = get_graph_matcher()

    graph_data = matcher.get_graph_data()

    # Filter by regulation if specified
    if regulation:
        graph_data["nodes"] = [
            n for n in graph_data["nodes"]
            if regulation.lower() in n.get("regulation", "").lower()
        ]
        node_ids = {n["id"] for n in graph_data["nodes"]}
        graph_data["edges"] = [
            e for e in graph_data["edges"]
            if e["source"] in node_ids and e["target"] in node_ids
        ]

    return GraphDataResponse(
        nodes=[n for n in graph_data["nodes"]],
        edges=[e for e in graph_data["edges"]],
    )


@router.get("/pasal/{pasal_id}")
async def get_pasal_detail(
    pasal_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get detailed information about a specific pasal"""
    matcher = get_graph_matcher()
    pasals = matcher.get_all_pasal()

    for p in pasals:
        if p.get("id") == pasal_id:
            return p

    raise HTTPException(status_code=404, detail="Pasal not found")
