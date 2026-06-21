#!/usr/bin/env python3
"""
Ingest Script: Load PP 35/2021 and related regulations into Kuzu graph + ChromaDB.

RUN ONCE during setup. Creates persistent reference graph.

Usage:
    cd server
    python -m scripts.ingest_regulations
"""

import os
import sys
import re
import json
import hashlib
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import get_settings
from app.services.pdf_parser import PDFParser
from app.core.config import get_settings

settings = get_settings()

# Regulation metadata
REGULATIONS = {
    "PP 35/2021": {
        "filename": "PP352021.pdf",
        "description": "Peraturan Pemerintah Nomor 35 Tahun 2021 tentang Perjanjian Kerja Waktu Tertentu, Alih Daya, Pemutusan Hubungan Kerja, dan Masa Percobaan",
    },
    "PP 36/2021": {
        "filename": "PP362021.pdf",
        "description": "Peraturan Pemerintah Nomor 36 Tahun 2021 tentang Pengupahan",
    },
    "UU 13/2003": {
        "filename": "UU13-2003Ketenagakerjaan.pdf",
        "description": "Undang-Undang Nomor 13 Tahun 2003 tentang Ketenagakerjaan",
    },
    "UU 6/2023": {
        "filename": "2023UU06_Naker.pdf",
        "description": "Undang-Undang Nomor 6 Tahun 2023 tentang Penetapan Peraturan Pemerintah Pengganti Undang-Undang Nomor 2 Tahun 2022",
    },
}


def extract_pasal_text(text: str, regulation: str) -> list[dict]:
    """
    Extract individual pasal from regulation text.
    Returns list of {nomor, teks, regulation}
    """
    pasals = []

    # More flexible pattern for markdown/text formats
    # Matches "Pasal XX", "# Pasal XX", "Pasal XX.", etc.
    pattern = r"(?:^|\n)(?:[#*]*\s*)?(?:Pasal\s+(\d+))(?:(?:\s+ayat\s*\((\d+)\))?)(?:\s*[:\.\-])?(?:\s*\n)([\s\S]*?)(?=(?:^|\n)(?:[#*]*\s*)?Pasal\s+\d+|$)"

    matches = re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE)

    for match in matches:
        nomor = match.group(1)
        ayat = match.group(2)
        teks = match.group(3).strip()

        # Clean up text
        teks = re.sub(r"\s+", " ", teks)
        teks = teks[:2000]  # Truncate long texts

        if len(teks) > 20:
            pasals.append({
                "nomor": nomor,
                "ayat": ayat if ayat else None,
                "teks": teks,
                "regulation": regulation,
                "id": f"{regulation.replace(' ', '_')}_Pasal{nomor}" + (f"_Ayat{ayat}" if ayat else ""),
            })

    return pasals


def determine_status(pasal_text: str, regulation: str) -> str:
    """
    Determine if a pasal is still active, revised, or revoked.
    """
    text_lower = pasal_text.lower()

    # Check for revocation phrases
    revocation_phrases = [
        "dicabut", "dihapus", "tidak berlaku", "不住的",
        " revoked", "abrogated", "berakhir"
    ]
    for phrase in revocation_phrases:
        if phrase in text_lower:
            return "dicabut"

    # Check for revision phrases
    revision_phrases = [
        "direvisi", "diubah", "disempurnakan", "modified",
        "amended", "sebagaimana telah diubah"
    ]
    for phrase in revision_phrases:
        if phrase in text_lower:
            return "direvisi"

    # PP 35/2021 is the base, UU 6/2023 amends some parts
    if regulation == "UU 6/2023":
        return "aktif"

    # UU 13/2003 is largely superseded by PP 35/2021
    if regulation == "UU 13/2003":
        return "direvisi"

    return "aktif"


def store_to_kuzu(pasals: list[dict]) -> bool:
    """Store pasal data to Kuzu graph database"""
    try:
        from llama_index.graph_stores.kuzu import KuzuGraphStore

        graph_store = KuzuGraphStore(db_path=settings.kuzu_db_path)

        for pasal in pasals:
            node_data = {
                "id": pasal["id"],
                "nomor": pasal["nomor"],
                "teks": pasal["teks"],
                "regulation": pasal["regulation"],
                "status": determine_status(pasal["teks"], pasal["regulation"]),
            }
            if pasal.get("ayat"):
                node_data["ayat"] = pasal["ayat"]

            graph_store.upsert(node_data)

        # Create relationships between related pasals
        # E.g., connecting新旧 versions
        graph_store.query("""
            MATCH (p1:Pasal), (p2:Pasal)
            WHERE p1.nomor = p2.nomor
              AND p1.regulation = 'UU 13/2003'
              AND p2.regulation = 'PP 35/2021'
            MERGE (p1)-[:REVISED_TO]->(p2)
        """)

        print(f"Stored {len(pasals)} pasal nodes to Kuzu")
        return True
    except Exception as e:
        print(f"Kuzu storage error: {e}")
        return False


def store_to_chroma(pasals: list[dict]) -> bool:
    """Store pasal embeddings to ChromaDB"""
    try:
        import chromadb
        from openai import OpenAI

        os.makedirs(settings.chroma_db_path, exist_ok=True)
        chroma_client = chromadb.PersistentClient(path=settings.chroma_db_path)
        collection = chroma_client.get_or_create_collection("regulation_pasal")

        client = OpenAI(api_key=settings.openai_api_key)

        # Batch process to avoid rate limits
        batch_size = 10
        for i in range(0, len(pasals), batch_size):
            batch = pasals[i:i+batch_size]
            texts = [f"Pasal {p['nomor']}: {p['teks']}" for p in batch]
            ids = [p["id"] for p in batch]
            metadatas = [
                {
                    "nomor": p["nomor"],
                    "regulation": p["regulation"],
                    "status": determine_status(p["teks"], p["regulation"]),
                }
                for p in batch
            ]

            # Get embeddings
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=texts
            )
            embeddings = [r.embedding for r in response.data]

            collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=texts,
                metadatas=metadatas
            )

            print(f"Stored batch {i//batch_size + 1} to ChromaDB")

        print(f"Stored {len(pasals)} pasal vectors to ChromaDB")
        return True
    except Exception as e:
        print(f"ChromaDB storage error: {e}")
        return False


def main():
    print("=" * 60)
    print("Check Kontrak - Regulation Ingest Script")
    print("=" * 60)

    data_dir = Path(__file__).parent.parent / "data"
    settings = get_settings()
    parser = PDFParser(api_key=settings.llamaparse_api_key)

    all_pasals = []

    for reg_name, reg_info in REGULATIONS.items():
        pdf_path = data_dir / reg_info["filename"]
        if not pdf_path.exists():
            print(f"[SKIP] {reg_name}: {pdf_path} not found")
            continue

        print(f"\n[PROCESSING] {reg_name}")
        print(f"  File: {reg_info['filename']}")

        # Parse PDF
        with open(pdf_path, "rb") as f:
            content = f.read()

        chunks = parser.parse(content, reg_info["filename"])
        full_text = "\n".join([c["text"] for c in chunks])

        # Debug: print first 500 chars
        print(f"  DEBUG text sample: {full_text[:500]}...")

        # Extract pasals
        pasals = extract_pasal_text(full_text, reg_name)
        print(f"  Found {len(pasals)} pasal")

        all_pasals.extend(pasals)

    if not all_pasals:
        print("\n[ERROR] No regulation data extracted!")
        return

    print(f"\n[TOTAL] {len(all_pasals)} pasal extracted")

    # Store to databases
    print("\n[STORE] Kuzu graph...")
    kuzu_success = store_to_kuzu(all_pasals)

    print("\n[STORE] ChromaDB vector store...")
    chroma_success = store_to_chroma(all_pasals)

    # Save summary
    summary = {
        "total_pasal": len(all_pasals),
        "regulations": {name: len([p for p in all_pasals if p["regulation"] == name])
                        for name in REGULATIONS.keys()},
        "kuzu_stored": kuzu_success,
        "chroma_stored": chroma_success,
    }

    summary_path = data_dir / "ingest_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    print("\n" + "=" * 60)
    print("Ingest complete!")
    print(f"Summary saved to: {summary_path}")
    print(json.dumps(summary, indent=2))
    print("=" * 60)


if __name__ == "__main__":
    main()
