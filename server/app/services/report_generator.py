from typing import Optional
from app.core.config import get_settings

settings = get_settings()


class ReportGenerator:
    """
    Generates contract analysis reports using LLM.
    Uses hedged language, never definitive legal conclusions.
    """

    DISLAIMER = (
        "Disclaimer: Hasil analisis ini bersifat edukasi awal dan BUKAN pengganti "
        "konsultasi hukum profesional. Klausul yang ditandai 'perlu dicek' menunjukkan "
        "potensi ketidaksesuaian yang perlu dikonsultasikan dengan ahli hukum."
    )

    def __init__(self):
        self.model = settings.openai_model
        self._client = None

    def _get_client(self):
        """Lazy init OpenAI client"""
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=settings.openai_api_key)
        return self._client

    def analyze_klausul(
        self,
        klausul_text: str,
        relevant_pasal: list[dict],
    ) -> dict:
        """
        Analyze a single clause against relevant regulations.
        Returns: {flag, pasal_rujukan, penjelasan}
        """
        if not relevant_pasal:
            return {
                "flag": "aman",
                "pasal_rujukan": [],
                "penjelasan": "Klausul ini tidak memiliki rujukan langsung ke peraturan yang diperiksa.",
            }

        # Build context for LLM
        pasal_context = self._build_pasal_context(relevant_pasal)
        prompt = self._build_prompt(klausul_text, pasal_context)

        try:
            response = self._get_client().chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Kamu adalah analis kontrak kerja yang membantu edukasi awal. "
                            "Selalu gunakan bahasa Indonesia. "
                            "Berikan analisis dengan bahasa yang hedged (tidak pasti). "
                            "Jangan pernah bilang sesuatu 'ilegal' - gunakan 'berpotensi tidak sesuai'. "
                            "Fokus pada PP 35/2021 dan UU Ketenagakerjaan Indonesia."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=500,
            )

            result_text = response.choices[0].message.content
            return self._parse_result(result_text, relevant_pasal)
        except Exception as e:
            return {
                "flag": "perlu_dicek",
                "pasal_rujukan": [p.get("id", "") for p in relevant_pasal],
                "penjelasan": f"Error dalam analisis: {str(e)}. Sebaiknya dikonsultasikan.",
            }

    def _build_pasal_context(self, pasal_list: list[dict]) -> str:
        """Build context string from relevant pasal"""
        context_parts = []
        for p in pasal_list:
            status = p.get("status", "aktif")
            status_emoji = {"aktif": "", "direvisi": "[DIREVISI]", "dicabut": "[DICABUT]"}.get(
                status, f"[{status.upper()}]"
            )
            context_parts.append(
                f"- Pasal {p.get('nomor', 'N/A')} ({p.get('regulation', '')}): "
                f"{p.get('teks', '')[:200]}... {status_emoji}"
            )
        return "\n".join(context_parts)

    def _build_prompt(self, klausul: str, pasal_context: str) -> str:
        """Build analysis prompt"""
        return f"""Analisis klausul kontrak berikut:

KLAUSUL: {klausul[:1000]}

PASAL YANG RELEVAN:
{pasal_context}

Tugas:
1. Bandingkan klausul dengan pasal-pasal di atas
2. Tentukan apakah klausul AMAN atau PERLU DICEK
3. Jika perlu dicek, jelaskan potensi ketidaksesuaiannya dengan bahasa yang hedged

Jawaban dalam format JSON:
{{
    "flag": "aman" atau "perlu_dicek",
    "penjelasan": "penjelasan dalam 1-2 kalimat, bahasa Indonesia, gunakan kata 'berpotensi' atau 'sebaiknya'"
}}

Jawaban JSON:"""

    def _parse_result(self, result_text: str, relevant_pasal: list[dict]) -> dict:
        """Parse LLM response into structured result"""
        import json
        import re

        # Try to extract JSON
        json_match = re.search(r"\{[^}]+\}", result_text, re.DOTALL)
        if json_match:
            try:
                parsed = json.loads(json_match.group())
                return {
                    "flag": parsed.get("flag", "perlu_dicek"),
                    "pasal_rujukan": [p.get("id", "") for p in relevant_pasal],
                    "penjelasan": parsed.get("penjelasan", "Analisis tidak tersedia."),
                }
            except json.JSONDecodeError:
                pass

        # Fallback
        if "aman" in result_text.lower():
            flag = "aman"
        else:
            flag = "perlu_dicek"

        return {
            "flag": flag,
            "pasal_rujukan": [p.get("id", "") for p in relevant_pasal],
            "penjelasan": result_text[:300] if result_text else "Analisis tidak tersedia.",
        }
