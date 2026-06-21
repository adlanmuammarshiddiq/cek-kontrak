from fastapi import APIRouter
from .endpoints import auth, contract, graph

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(contract.router)
api_router.include_router(graph.router)
