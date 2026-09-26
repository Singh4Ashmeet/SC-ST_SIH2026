"""
Storage service for Supabase / S3-compatible object storage.

Provides file upload, presigned URL generation, key resolution, and file retrieval.
"""

import logging
import uuid
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import get_settings

settings = get_settings()

logger = logging.getLogger(__name__)


class StorageService:
    """Wrapper around boto3 S3 client for Supabase S3 Storage operations."""

    def __init__(self):
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.MINIO_ENDPOINT,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=Config(
                signature_version="s3v4",
                connect_timeout=3,
                read_timeout=5,
                retries={"max_attempts": 2}
            ),
            region_name="ap-northeast-1",
        )
        self._bucket = settings.MINIO_BUCKET_NAME

    def ensure_bucket_exists(self) -> None:
        """Create the bucket if it doesn't exist."""
        try:
            self._client.head_bucket(Bucket=self._bucket)
            logger.info(f"Bucket '{self._bucket}' already exists")
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code in ("404", "NoSuchBucket"):
                try:
                    self._client.create_bucket(Bucket=self._bucket)
                    logger.info(f"Created bucket '{self._bucket}'")
                except ClientError as create_error:
                    logger.error(f"Failed to create bucket: {create_error}")
                    raise
            else:
                logger.error(f"Error checking bucket: {e}")
                raise

    def resolve_key(self, key: str) -> str:
        """
        Check if key exists in Supabase storage.
        If direct key is missing, resolve to an actual uploaded file in Supabase matching doc_type.
        """
        try:
            self._client.head_object(Bucket=self._bucket, Key=key)
            return key
        except Exception:
            pass

        # Parse doc_type from key structure e.g. ".../caste_certificate/bikram_st_cert.pdf"
        parts = key.split("/")
        raw_type = parts[1] if len(parts) >= 2 else parts[0]
        
        alias_map = {
            "caste": "caste_certificate",
            "income": "income_certificate",
            "bonafide": "bonafide_certificate",
            "admission": "admission_letter",
            "transcript": "degree_transcript",
            "ielts": "ielts_toefl_scorecard",
        }
        doc_type = alias_map.get(raw_type.lower(), raw_type)

        try:
            resp = self._client.list_objects_v2(Bucket=self._bucket)
            for obj in resp.get("Contents", []):
                obj_key = obj["Key"]
                if f"/{doc_type}/" in obj_key or obj_key.startswith(f"{doc_type}/"):
                    return obj_key
                if raw_type in obj_key:
                    return obj_key
        except Exception as e:
            logger.warning(f"Key resolution failed for {key}: {e}")

        return key

    def upload_file(
        self,
        file_bytes: bytes,
        key: str,
        content_type: str,
    ) -> str:
        """Upload file bytes to storage."""
        try:
            self._client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )
            logger.info(f"Uploaded file to {key}")
            return key
        except ClientError as e:
            logger.error(f"Failed to upload file: {e}")
            raise

    def get_presigned_url(
        self,
        key: str,
        expires_seconds: int = 3600,
    ) -> str:
        """Generate a presigned URL for downloading a file."""
        resolved_key = self.resolve_key(key)
        try:
            url = self._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": resolved_key},
                ExpiresIn=expires_seconds,
            )
            return url
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            raise

    def delete_file(self, key: str) -> None:
        """Delete a file from storage."""
        resolved_key = self.resolve_key(key)
        try:
            self._client.delete_object(Bucket=self._bucket, Key=resolved_key)
            logger.info(f"Deleted file {resolved_key}")
        except ClientError as e:
            logger.error(f"Failed to delete file: {e}")
            raise

    def download_file(self, key: str) -> bytes:
        """Download a file from storage."""
        resolved_key = self.resolve_key(key)
        try:
            response = self._client.get_object(Bucket=self._bucket, Key=resolved_key)
            file_bytes = response["Body"].read()
            logger.info(f"Downloaded file {resolved_key} ({len(file_bytes)} bytes)")
            return file_bytes
        except ClientError as e:
            logger.error(f"Failed to download file {resolved_key}: {e}")
            raise

    @staticmethod
    def generate_storage_key(
        application_id: uuid.UUID,
        doc_type: str,
        original_filename: str,
    ) -> str:
        """Generate a storage key for a document."""
        ext = original_filename.split(".")[-1].lower() if "." in original_filename else ""
        unique_id = uuid.uuid4().hex[:12]
        if ext:
            return f"{application_id}/{doc_type}/{unique_id}.{ext}"
        return f"{application_id}/{doc_type}/{unique_id}"


# Shared singleton instance
storage_service = StorageService()