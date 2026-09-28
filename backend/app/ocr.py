"""
MedBridge OCR module  —  app/ocr.py

Provides an abstract OCREngine interface so Tesseract can be swapped for
any other engine (PaddleOCR, cloud vision, etc.) without changing callers.

Returns: list of TextBlock with text + bounding box + per-word confidence.

If Tesseract is not installed, returns an empty list with a warning
(the app drops to manual-entry mode — it never dead-ends).
"""
from __future__ import annotations

import io
import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 10 * 1024 * 1024   # 10 MB
MAX_IMAGE_DIM   = 4000               # pixels


@dataclass
class TextBlock:
    text: str
    confidence: float          # 0-1
    x: int
    y: int
    width: int
    height: int
    page: int = 0


# ── Abstract interface ─────────────────────────────────────────────────────────

class OCREngine(ABC):
    @abstractmethod
    def extract(self, image_bytes: bytes) -> tuple[str, list[TextBlock]]:
        """
        Extract text from image bytes.

        Returns:
          (full_text: str, blocks: list[TextBlock])

        Must never raise — on failure return ("", []) and log the error.
        """


# ── Image pre-processing ──────────────────────────────────────────────────────

def preprocess_image(image_bytes: bytes) -> Optional[np.ndarray]:
    """
    Validate and pre-process an image for OCR.
    Steps: decode → size check → downscale → grayscale → deskew → threshold.

    Returns None if the image cannot be decoded.
    """
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            logger.warning("Could not decode image")
            return None

        # Downscale very large images
        h, w = img.shape[:2]
        if max(h, w) > MAX_IMAGE_DIM:
            scale = MAX_IMAGE_DIM / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)))

        # Grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Deskew: find the dominant angle and rotate
        gray = _deskew(gray)

        # Adaptive threshold (good for varying brightness)
        thresh = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11, 2,
        )
        return thresh
    except Exception as e:
        logger.warning("Image preprocessing failed: %s", e)
        return None


def _deskew(gray: np.ndarray) -> np.ndarray:
    """Rotate image to correct skew using Hough lines. Max ±15°."""
    try:
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLines(edges, 1, np.pi / 180, 100)
        if lines is None or len(lines) < 5:
            return gray
        angles = []
        for line in lines[:30]:
            rho, theta = line[0]
            angle = (theta * 180 / np.pi) - 90
            if abs(angle) < 15:
                angles.append(angle)
        if not angles:
            return gray
        median_angle = float(np.median(angles))
        h, w = gray.shape
        M = cv2.getRotationMatrix2D((w // 2, h // 2), median_angle, 1.0)
        return cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    except Exception:
        return gray


def quality_check(image_bytes: bytes) -> tuple[bool, str]:
    """
    Basic image quality gate.
    Returns (ok: bool, reason: str).

    Checks:
    - Decodable
    - Not too small
    - Blur (Laplacian variance) above threshold
    - Not too dark / too bright
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return False, "Image could not be read. Please try a different file."

    h, w = img.shape[:2]
    if h < 100 or w < 100:
        return False, "Image is too small. Please take a clearer photo."

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Blur detection
    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    if lap_var < 40:
        return False, f"Image appears blurry (sharpness score: {lap_var:.0f}). Please retake."

    # Brightness
    mean_brightness = float(gray.mean())
    if mean_brightness < 30:
        return False, "Image is too dark. Please use more light."
    if mean_brightness > 240:
        return False, "Image is too bright / overexposed. Please reduce glare."

    return True, "ok"


# ── Tesseract implementation ───────────────────────────────────────────────────

class TesseractEngine(OCREngine):
    """
    Tesseract OCR engine using pytesseract.
    Language: eng+tam (falls back to eng only if Tamil data missing).
    """

    def __init__(self) -> None:
        self._available = False
        self._lang = "eng+tam"
        try:
            import pytesseract
            # Allow override via env var (for Windows installs not on PATH)
            tess_cmd = os.environ.get("TESSERACT_CMD")
            if tess_cmd:
                pytesseract.pytesseract.tesseract_cmd = tess_cmd
            # Quick probe
            available_langs = pytesseract.get_languages()
            self._available = True
            if "tam" not in available_langs:
                logger.warning("Tamil language data not found; falling back to eng only.")
                self._lang = "eng"
            self._pytesseract = pytesseract
        except Exception as e:
            logger.warning("Tesseract not available: %s — OCR disabled, use demo mode.", e)

    def extract(self, image_bytes: bytes) -> tuple[str, list[TextBlock]]:
        if not self._available:
            return "", []

        processed = preprocess_image(image_bytes)
        if processed is None:
            return "", []

        try:
            pil_img = Image.fromarray(processed)

            # Full text
            full_text: str = self._pytesseract.image_to_string(
                pil_img, lang=self._lang, config="--psm 6"
            )

            # Per-word data with confidence and bboxes
            data = self._pytesseract.image_to_data(
                pil_img, lang=self._lang,
                output_type=self._pytesseract.Output.DICT,
                config="--psm 6",
            )

            blocks: list[TextBlock] = []
            n = len(data["text"])
            for i in range(n):
                word = data["text"][i].strip()
                conf_raw = int(data["conf"][i])
                if not word or conf_raw < 0:
                    continue
                blocks.append(TextBlock(
                    text=word,
                    confidence=conf_raw / 100.0,
                    x=int(data["left"][i]),
                    y=int(data["top"][i]),
                    width=int(data["width"][i]),
                    height=int(data["height"][i]),
                    page=int(data.get("page_num", [0]*n)[i]),
                ))

            return full_text, blocks

        except Exception as e:
            logger.error("Tesseract extraction failed: %s", e)
            return "", []


# ── Singleton engine ───────────────────────────────────────────────────────────

_engine: Optional[TesseractEngine] = None


def get_engine() -> TesseractEngine:
    global _engine
    if _engine is None:
        _engine = TesseractEngine()
    return _engine
