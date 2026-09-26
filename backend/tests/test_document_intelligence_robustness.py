"""
Negative and robustness tests for Document Intelligence and Field Extraction.

Validates that:
- Administrative titles (District Magistrate, Collector, Commissioner) are never extracted as district names.
- Currency conversions handle Lakhs, commas, and symbol variations accurately.
- Salutations (Shri, Smt, etc.) are stripped cleanly from applicant names.
- Dates normalize to ISO YYYY-MM-DD.
- Document and field confidence metrics are realistic and exposed.
- Provider abstractions function without unconfigured external dependencies.
"""

import pytest
from app.services.field_extraction_service import (
    extract_fields,
    FieldExtractor,
    _extract_district,
    _extract_authority,
)
from app.services.ocr_service import (
    get_document_intelligence_provider,
    MockDocumentProvider,
    TesseractDocumentProvider,
    _calculate_text_quality_confidence,
)


class TestFieldExtractionRobustness:
    """Rigorous tests including negative cases against common OCR failure modes."""

    def test_district_magistrate_not_extracted_as_district(self):
        """Negative test: 'District Magistrate, Garhwa' must extract Garhwa, never Magistrate."""
        text = """
        GOVERNMENT OF JHARKHAND
        Office of the District Magistrate / Sub-Divisional Magistrate
        CASTE / TRIBE CERTIFICATE
        Resident of Village Garhwa Rural Area, Tehsil Garhwa, District Garhwa, State of Jharkhand.
        belongs to the Asur tribe
        """
        fields = extract_fields(text, "caste_certificate")
        assert "district" in fields
        assert fields["district"]["value"].lower() != "magistrate"
        assert fields["district"]["value"] == "Garhwa"
        assert fields["district"]["confidence"] >= 0.85

    def test_district_collector_not_extracted_as_district(self):
        """Negative test: 'Office of District Collector, Ranchi' must extract Ranchi, never Collector."""
        text = """
        Office of District Collector and District Magistrate
        Resident of District Ranchi, State of Jharkhand.
        belongs to the Munda tribe
        """
        fields = extract_fields(text, "caste_certificate")
        assert "district" in fields
        assert fields["district"]["value"].lower() not in ["collector", "magistrate"]
        assert fields["district"]["value"] == "Ranchi"

    def test_income_lakh_normalization(self):
        """Ensure 'Rs. 3.80 Lakh' correctly normalizes to 380000 integer string."""
        text = """
        INCOME CERTIFICATE
        Name: Priya Kumari
        Annual Family Income: Rs. 3.80 Lakh per annum
        Issuing Authority: Tehsildar, Ranchi
        Date: 12/04/2026
        """
        fields = extract_fields(text, "income_certificate")
        assert "annual_income" in fields
        assert fields["annual_income"]["value"] == "380000"

    def test_income_with_rupee_symbol_and_commas(self):
        """Ensure '₹ 4,50,000/-' normalizes to 450000."""
        text = """
        INCOME CERTIFICATE
        Name: Arjun Munda
        Total Annual Income: ₹ 4,50,000/- only
        Date: 10-06-2026
        """
        fields = extract_fields(text, "income_certificate")
        assert "annual_income" in fields
        assert fields["annual_income"]["value"] == "450000"

    def test_name_strips_salutations(self):
        """Ensure Shri/Smt/Kumari honorifics are stripped from extracted applicant name."""
        text = """
        CASTE CERTIFICATE
        This is to certify that:
        Shri/Smt. Asur Hansda
        Son/Daughter of Shri Asur Munda
        belongs to the Asur tribe
        """
        fields = extract_fields(text, "caste_certificate")
        assert "applicant_name" in fields
        assert fields["applicant_name"]["value"] == "Asur Hansda"
        assert "Shri" not in fields["applicant_name"]["value"]
        assert "father_name" in fields
        assert fields["father_name"]["value"] == "Asur Munda"

    def test_authority_detects_real_designations(self):
        """Ensure competent issuing authorities are extracted cleanly."""
        text = """
        CASTE CERTIFICATE
        Office of the Sub-Divisional Magistrate
        Place: Goalpara
        Tehsildar, Goalpara
        """
        fields = extract_fields(text, "caste_certificate")
        assert "issuing_authority" in fields
        assert any(auth in fields["issuing_authority"]["value"] for auth in ["Tehsildar", "Sub-Divisional Magistrate"])

    def test_date_normalization_variations(self):
        """Ensure various date formats normalize to ISO YYYY-MM-DD."""
        assert FieldExtractor.normalize_date("15/08/2026") == "2026-08-15"
        assert FieldExtractor.normalize_date("15-08-2026") == "2026-08-15"
        assert FieldExtractor.normalize_date("2026-08-15") == "2026-08-15"

    def test_text_quality_confidence_calculation(self):
        """Verify realistic text quality confidence scoring."""
        # Clean text with certificate keywords
        clean_text = "Government of India Caste Certificate District Ranchi State Jharkhand Date 15/08/2026 Resident Name Rajesh Kumar"
        high_conf = _calculate_text_quality_confidence(clean_text)
        assert high_conf >= 0.80

        # Noisy / garbage text
        garbage_text = "%$# @!~ ^&* ??"
        low_conf = _calculate_text_quality_confidence(garbage_text)
        assert low_conf <= 0.35

        # Empty text
        assert _calculate_text_quality_confidence("") == 0.0

    def test_mock_provider_transparently_labeled(self):
        """Verify mock provider explicitly designates itself as sandbox."""
        provider = MockDocumentProvider()
        info = provider.get_provider_info()
        assert info["is_simulation"] is True
        assert "sandbox" in info["provider_name"].lower() or "mock" in info["provider_name"].lower()
