from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from datetime import datetime
import uuid
import json
import os
from typing import Optional
from app.models.schemas import AnalisisResponse, KlausulMencurigakan
from app.core.dependencies import get_current_user
from app.core.config import get_settings
from app.services.pdf_parser import PDFParser
from app.services.graph_matcher import GraphMatcher
from app.services.report_generator import ReportGenerator

router = APIRouter(prefix="/contract", tags=["Contract Analysis"])

# Services (lazy init)
_pdf_parser: Optional[PDFParser] = None
_graph_matcher: Optional[GraphMatcher] = None
_report_generator: Optional[ReportGenerator] = None

# In-memory results store (for MVP)
RESULTS_STORE: dict[str, dict] = {}


def get_pdf_parser() -> PDFParser:
    global _pdf_parser
    if _pdf_parser is None:
        settings = get_settings()
        _pdf_parser = PDFParser(api_key=settings.llamaparse_api_key)
    return _pdf_parser


def get_graph_matcher() -> GraphMatcher:
    global _graph_matcher
    if _graph_matcher is None:
        _graph_matcher = GraphMatcher()
    return _graph_matcher


def get_report_generator() -> ReportGenerator:
    global _report_generator
    if _report_generator is None:
        _report_generator = ReportGenerator()
    return _report_generator


@router.post("/upload", response_model=AnalisisResponse)
async def upload_and_analyze(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload contract PDF and get analysis.
    Returns list of clauses with flags and relevant pasal.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be PDF",
        )

    # Read file
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large (max 10MB)",
        )

    # Parse PDF
    parser = get_pdf_parser()
    try:
        chunks = parser.parse(content, file.filename)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF parsing failed: {str(e)}",
        )

    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No text content extracted from PDF",
        )

    # Analyze each clause
    graph_matcher = get_graph_matcher()
    report_gen = get_report_generator()

    results = []
    klausul_aman = 0
    klausul_perlu_dicek = 0

    for chunk in chunks:
        clause_text = chunk["text"]

        # Find relevant pasal
        relevant_pasal = graph_matcher.find_relevant_pasal(clause_text)

        # Generate analysis
        analysis = report_gen.analyze_klausul(clause_text, relevant_pasal)

        if analysis["flag"] == "aman":
            klausul_aman += 1
        else:
            klausul_perlu_dicek += 1
            results.append(KlausulMencurigakan(
                teks=clause_text[:500],
                flag=analysis["flag"],
                pasal_rujukan=analysis["pasal_rujukan"],
                penjelasan=analysis["penjelasan"],
            ))

    # Store result
    result_id = str(uuid.uuid4())
    result_data = {
        "id": result_id,
        "filename": file.filename,
        "user_id": current_user.get("sub"),
        "total_klausul": len(chunks),
        "klausul_aman": klausul_aman,
        "klausul_perlu_dicek": klausul_perlu_dicek,
        "hasil": [r.model_dump() for r in results],
        "created_at": datetime.now().isoformat(),
    }
    RESULTS_STORE[result_id] = result_data

    return AnalisisResponse(
        id=result_id,
        filename=file.filename,
        total_klausul=len(chunks),
        klausul_aman=klausul_aman,
        klausul_perlu_dicek=klausul_perlu_dicek,
        hasil=results,
        disclaimer=ReportGenerator.DISLAIMER,
        created_at=datetime.now(),
    )


@router.get("/result/{result_id}", response_model=AnalisisResponse)
async def get_result(
    result_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get analysis result by ID"""
    result = RESULTS_STORE.get(result_id)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found",
        )

    # Check ownership
    if result.get("user_id") != current_user.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return AnalisisResponse(
        id=result["id"],
        filename=result["filename"],
        total_klausul=result["total_klausul"],
        klausul_aman=result["klausul_aman"],
        klausul_perlu_dicek=result["klausul_perlu_dicek"],
        hasil=[KlausulMencurigakan(**r) for r in result["hasil"]],
        disclaimer=ReportGenerator.DISLAIMER,
        created_at=datetime.fromisoformat(result["created_at"]),
    )
