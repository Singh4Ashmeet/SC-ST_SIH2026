#!/usr/bin/env python3
"""
Standalone OCR verification script.

Walks a directory, runs OCR on each file, tries field extraction for all
doc types, and prints a detailed report.
"""

import sys
import os
import mimetypes
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import argparse

# Add the backend directory to sys.path so we can import app modules
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.services.ocr_service import extract_text
from app.services.field_extraction_service import extract_fields, DOC_TYPES


def get_content_type(filepath: Path) -> str:
    """Infer content type from file extension."""
    ext = filepath.suffix.lower()
    if ext == '.pdf':
        return 'application/pdf'
    elif ext in ('.jpg', '.jpeg'):
        return 'image/jpeg'
    elif ext == '.png':
        return 'image/png'
    elif ext in ('.tiff', '.tif'):
        return 'image/tiff'
    elif ext == '.bmp':
        return 'image/bmp'
    else:
        # Let mimetypes guess
        guessed, _ = mimetypes.guess_type(str(filepath))
        return guessed or 'application/octet-stream'


def process_file(filepath: Path) -> Tuple[str, Optional[str], Dict[str, Dict]]:
    """
    Process a single file: OCR + field extraction for all doc types.
    
    Returns:
        (filename, raw_ocr_text, best_fields_by_doctype)
    """
    content_type = get_content_type(filepath)
    
    # Read file bytes
    try:
        with open(filepath, 'rb') as f:
            file_bytes = f.read()
    except Exception as e:
        return (filepath.name, None, {})
    
    # Extract text via OCR
    raw_text = extract_text(file_bytes, content_type)
    
    if not raw_text or not raw_text.strip():
        return (filepath.name, None, {})
    
    # Try field extraction for each doc type
    results_by_doctype = {}
    for doc_type in DOC_TYPES:
        try:
            fields = extract_fields(raw_text, doc_type)
            if fields:
                results_by_doctype[doc_type] = fields
        except Exception as e:
            pass
    
    return (filepath.name, raw_text, results_by_doctype)


def find_best_doctype(results_by_doctype: Dict[str, Dict]) -> Optional[str]:
    """Find the doc_type with the most extracted fields."""
    if not results_by_doctype:
        return None
    return max(results_by_doctype.items(), key=lambda x: len(x[1]))[0]


def format_fields(fields: Dict) -> str:
    """Format fields for pretty printing."""
    if not fields:
        return "  (no fields extracted)"
    lines = []
    for field, info in fields.items():
        value = info.get('value', '')
        confidence = info.get('confidence', '?')
        lines.append(f"    {field}: {value} [{confidence}]")
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description='Verify OCR and field extraction on SCST files')
    parser.add_argument('directory', nargs='?', default='../SCST',
                        help='Directory to scan (default: ../SCST)')
    args = parser.parse_args()
    
    root = Path(args.directory).resolve()
    if not root.exists():
        print(f"Directory not found: {root}")
        return 1
    
    print(f"Scanning: {root}")
    print("=" * 80)
    
    # Supported extensions
    supported_exts = {'.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp'}
    
    # Walk directory
    files = []
    for root_dir, dirs, filenames in os.walk(root):
        for fname in filenames:
            ext = Path(fname).suffix.lower()
            if ext in supported_exts:
                files.append(Path(root_dir) / fname)
    
    if not files:
        print("No supported files found.")
        return 0
    
    print(f"Found {len(files)} supported files")
    print("=" * 80)
    
    total_files = len(files)
    ocr_success = 0
    field_success = 0
    
    for filepath in files:
        filename = filepath.name
        print(f"\n[FILE] {filepath.relative_to(root)}")
        print("-" * 80)
        
        filename, raw_text, results_by_doctype = process_file(filepath)
        
        if raw_text is None:
            print("  [FAILED] Could not read file")
            continue
        
        if not raw_text or not raw_text.strip():
            print("  [FAILED] OCR returned empty text")
            continue
        
        ocr_success += 1
        print(f"  [OK] OCR succeeded ({len(raw_text)} chars)")
        
        # Show first 300 chars of OCR text
        preview = raw_text[:300].replace('\n', ' ')
        if len(raw_text) > 300:
            preview += "..."
        print(f"  OCR text: {preview}")
        
        if not results_by_doctype:
            print("  [WARN] No fields extracted for any doc type")
            continue
        
        # Find best matching doc type
        best_doctype = find_best_doctype({dt: f for dt, f in results_by_doctype.items()})
        field_success += 1
        
        print(f"  Best match: {best_doctype} ({len(results_by_doctype[best_doctype])} fields)")
        print(f"  All doc type results:")
        for dt, fields in results_by_doctype.items():
            marker = " *" if dt == best_doctype else ""
            print(f"    {dt}: {len(fields)} fields{marker}")
            print(format_fields(fields))
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total files scanned:     {total_files}")
    print(f"OCR succeeded:           {ocr_success}/{total_files}")
    print(f"At least one field:      {field_success}/{total_files}")
    print(f"OCR failure rate:        {total_files - ocr_success}/{total_files}")
    print(f"Field extraction failure: {total_files - field_success}/{total_files}")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())