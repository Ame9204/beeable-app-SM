"""LLM providers behind one small interface, so switching provider is one env var."""

from typing import Protocol

from config import (
    DEMO_INTAKE_PATH, GEMINI_API_KEY, INTAKE_MODEL, INTAKE_PROVIDER, INTAKE_THINKING_LEVEL, INTAKE_TIMEOUT_S,
)
from intake.prompt import SYSTEM_PROMPT


class Provider(Protocol):
    name: str

    def suggest(self, image: bytes | None, mime: str, prompt: str) -> str:
        """Return the model's raw text (expected to be JSON). Raise on transport/auth errors."""
        ...


class GeminiProvider:
    name = "gemini"

    def __init__(self, api_key: str, model: str = INTAKE_MODEL, timeout_s: float = INTAKE_TIMEOUT_S):
        from google import genai
        from google.genai import types

        self._types = types
        self._model = model
        self._client = genai.Client(
            api_key=api_key, http_options=types.HttpOptions(timeout=int(timeout_s * 1000))
        )

    def suggest(self, image: bytes | None, mime: str, prompt: str) -> str:
        types = self._types
        contents: list = [prompt]
        if image:
            contents.insert(0, types.Part.from_bytes(data=image, mime_type=mime))
        resp = self._client.models.generate_content(
            model=self._model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.2,
                # Short, structured task: little thinking keeps it to a few seconds.
                thinking_config=(
                    types.ThinkingConfig(thinking_level=INTAKE_THINKING_LEVEL.upper()) if INTAKE_THINKING_LEVEL else None
                ),
            ),
        )
        return resp.text or ""


class CachedProvider:
    """Returns the stored demo response. Used for the demo photo and when INTAKE_PROVIDER=cached."""

    name = "cached"

    def suggest(self, image: bytes | None, mime: str, prompt: str) -> str:
        return DEMO_INTAKE_PATH.read_text(encoding="utf-8")


def get_provider() -> Provider | None:
    """None means no live provider is configured; the service falls back."""
    if INTAKE_PROVIDER == "cached":
        return CachedProvider()
    if INTAKE_PROVIDER == "gemini" and GEMINI_API_KEY:
        return GeminiProvider(GEMINI_API_KEY)
    return None
