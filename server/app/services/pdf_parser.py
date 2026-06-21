from llama_parse import LlamaParse
from typing import Optional
import logging
import tempfile
import os
import re

logger = logging.getLogger(__name__)


class PDFParser:
    """
    Parse PDF using LlamaParse (cloud API, high accuracy).
    No local resource needed, accuracy for legal documents.
    """

    def __init__(self, api_key: str):
        self.parser = LlamaParse(
            api_key=api_key,
            result_type="markdown",
            premium_mode=False,
        )

    def parse(self, file_content: bytes, filename: str) -> list[dict]:
        """
        Parse PDF using LlamaParse.
        Returns list of chunks with text and metadata.
        """
        # Write to temp file for LlamaParse
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name

        try:
            result = self.parser.load_data(tmp_path)

            if not result:
                raise Exception("No content extracted from PDF")

            # Combine all pages text
            full_text = "\n\n".join([r.text for r in result if r.text])

            if not full_text.strip():
                raise Exception("No text content extracted from PDF")

            # Split into chunks
            chunks = self._split_text(full_text)

            return chunks

        except Exception as e:
            logger.error(f"LlamaParse error: {e}")
            raise Exception(f"PDF parsing failed: {str(e)}")

        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    def _split_text(self, text: str, chunk_size: int = 1000) -> list[dict]:
        """
        Split long text into chunks at paragraph boundaries.
        """
        # Clean up text
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()

        # Split by newlines or double newlines
        parts = re.split(r'\n\n+|\n(?=[A-Z0-9])', text)

        chunks = []
        current_chunk = []
        current_length = 0

        for part in parts:
            part = part.strip()
            if not part or len(part) < 20:
                continue

            if self._is_noise(part):
                continue

            part_len = len(part)
            if current_length + part_len > chunk_size and current_chunk:
                chunks.append({
                    "text": " ".join(current_chunk),
                    "page": 1,
                    "element_type": "Paragraph",
                })
                current_chunk = [part]
                current_length = part_len
            else:
                current_chunk.append(part)
                current_length += part_len

        if current_chunk:
            chunks.append({
                "text": " ".join(current_chunk),
                "page": 1,
                "element_type": "Paragraph",
            })

        return chunks

    def _is_noise(self, text: str) -> bool:
        """Filter noise text"""
        if len(text) < 30:
            return True
        if text.strip().isdigit():
            return True
        return False
