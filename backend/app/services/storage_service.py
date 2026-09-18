"""
Storage service for MinIO/S3-compatible object storage.

Provides file upload, presigned URL generation, and file deletion.
"""

import logging
import uuid
from contextlib import asynccontextmanager
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import get_settings

settings = get_settings()

logger = logging.getLogger(__name__)


class StorageService:
    """Wrapper around boto3 S3 client for MinIO operations."""

    def __init__(self):
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.MINIO_ENDPOINT,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=Config(
                signature_version="s3v4",
                connect_timeout=2,
                read_timeout=2,
                retries={"max_attempts": 1}
            ),
            region_name="us-east-1",  # MinIO doesn't use regions but boto3 requires it
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

    def upload_file(
        self,
        file_bytes: bytes,
        key: str,
        content_type: str,
    ) -> str:
        """
        Upload file bytes to storage.

        Args:
            file_bytes: File content as bytes
            key: Storage key (path) for the file
            content_type: MIME type of the file

        Returns:
            The storage key that was used
        """
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
        """
        Generate a presigned URL for downloading a file.

        Args:
            key: Storage key of the file
            expires_seconds: URL expiration time in seconds (default 1 hour)

        Returns:
            Presigned URL string
        """
        try:
            url = self._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=expires_seconds,
            )
            return url
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            raise

    def delete_file(self, key: str) -> None:
        """
        Delete a file from storage.

        Args:
            key: Storage key of the file to delete
        """
        try:
            self._client.delete_object(Bucket=self._bucket, Key=key)
            logger.info(f"Deleted file {key}")
        except ClientError as e:
            logger.error(f"Failed to delete file: {e}")
            raise

    def download_file(self, key: str) -> bytes:
        """
        Download a file from storage.

        Args:
            key: Storage key of the file to download

        Returns:
            File content as bytes
        """
        try:
            response = self._client.get_object(Bucket=self._bucket, Key=key)
            file_bytes = response["Body"].read()
            logger.info(f"Downloaded file {key}")
            return file_bytes
        except ClientError as e:
            logger.error(f"Failed to download file: {e}")
            raise

    @staticmethod
    def generate_storage_key(
        application_id: uuid.UUID,
        doc_type: str,
        original_filename: str,
    ) -> str:
        """
        Generate a storage key for a document.

        Format: {application_id}/{doc_type}/{uuid}.{ext}
        """
        ext = original_filename.split(".")[-1].lower() if "." in original_filename else ""
        unique_id = uuid.uuid4().hex[:12]
        if ext:
            return f"{application_id}/{doc_type}/{unique_id}.{ext}"
        return f"{application_id}/{doc_type}/{unique_id}"


# Shared singleton instance
storage_service = StorageService()