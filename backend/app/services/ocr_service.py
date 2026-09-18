"""
OCR service for extracting text from images and PDFs.
"""

import io
import logging
import os
import subprocess
import tempfile
from typing import Optional

import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image

# Configure Tesseract path for Windows
import sys
if sys.platform == "win32":
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

logger = logging.getLogger(__name__)


def extract_text(file_bytes: bytes, content_type: str) -> str:
    """
    Extract text from an image or PDF file using OCR.

    Args:
        file_bytes: Raw file bytes
        content_type: MIME type of the file

    Returns:
        Extracted text as a string. Returns empty string on failure.
    """
    if not file_bytes:
        logger.warning("Empty file bytes provided to OCR")
        return ""

    try:
        if content_type == "application/pdf":
            return _extract_text_from_pdf(file_bytes)
        elif content_type in ("image/jpeg", "image/jpg", "image/png", "image/jpeg"):
            return _extract_text_from_image(file_bytes, content_type)
        else:
            logger.warning(f"Unsupported content type for OCR: {content_type}")
            return ""
    except Exception as e:
        logger.warning(f"OCR extraction failed: {e}")
        return ""


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF by converting pages to images and running OCR on each."""
    try:
        # Convert PDF pages to images
        images = convert_from_bytes(
            file_bytes,
            dpi=300,  # Higher DPI for better OCR accuracy
            fmt="png",
            thread_count=2,
        )

        if not images:
            logger.warning("PDF conversion produced no images")
            return ""

        # OCR each page and concatenate
        all_text = []
        for i, image in enumerate(images):
            try:
                page_text = pytesseract.image_to_string(image, lang="eng")
                if page_text.strip():
                    all_text.append(f"--- Page {i + 1} ---\n{page_text}")
            except Exception as e:
                logger.warning(f"OCR failed on page {i + 1}: {e}")

        return "\n\n".join(all_text)

    except Exception as e:
        logger.warning(f"PDF to image conversion failed: {e}")
        return ""


def _extract_text_from_image(file_bytes: bytes, content_type: str) -> str:
    """Extract text directly from an image file."""
    import tempfile
    import subprocess
    import os
    
    try:
        # Write bytes to a temporary file and pass to tesseract directly
        # This preserves the original image format better than PIL save/load
        suffix = '.png'
        if content_type == 'image/jpeg' or content_type == 'image/jpg':
            suffix = '.jpg'
        elif content_type == 'image/tiff':
            suffix = '.tiff'
        elif content_type == 'image/bmp':
            suffix = '.bmp'
        
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name
        
        try:
            result = subprocess.run([
                pytesseract.pytesseract.tesseract_cmd,
                tmp_path, 'stdout', '-l', 'eng'
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                return result.stdout.strip()
            else:
                logger.warning(f"Tesseract OCR failed: {result.stderr}")
                return ""
        finally:
            try:
                os.unlink(tmp_path)
            except:
                pass
                
    except Exception as e:
        logger.warning(f"Image OCR failed: {e}")
        return ""