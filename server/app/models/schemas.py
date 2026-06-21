from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# Auth
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=2)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Contract Analysis
class KlausulMencurigakan(BaseModel):
    teks: str
    flag: str = Field(..., description="aman atau perlu_dicek")
    pasal_rujukan: list[str]
    penjelasan: str


class AnalisisResponse(BaseModel):
    id: str
    filename: str
    total_klausul: int
    klausul_aman: int
    klausul_perlu_dicek: int
    hasil: list[KlausulMencurigakan]
    disclaimer: str
    created_at: datetime


# Graph
class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    status: str


class GraphEdge(BaseModel):
    source: str
    target: str
    relation: str


class GraphDataResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


# Health
class HealthResponse(BaseModel):
    status: str
    version: str
    database_ready: bool
