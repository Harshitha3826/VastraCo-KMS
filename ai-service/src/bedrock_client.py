"""
Explicit Bedrock Runtime client.

Always uses credentials supplied via environment variables — never the default
AWS credential chain (no ~/.aws/credentials, no instance profiles, no IAM roles).

Import `bedrock_runtime` from here wherever a boto3 bedrock-runtime client is needed.
"""
import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError

from src.config import settings

logger = logging.getLogger(__name__)


def _create_bedrock_runtime_client():
    """
    Create a bedrock-runtime boto3 client using only the credentials in .env.

    Raises ValueError immediately if the required env vars are not set so the
    service fails fast at import time rather than at the first API call.
    """
    if not settings.AWS_ACCESS_KEY_ID:
        raise ValueError(
            "AWS_ACCESS_KEY_ID is not set. "
            "Add it to your .env file before starting the service."
        )
    if not settings.AWS_SECRET_ACCESS_KEY:
        raise ValueError(
            "AWS_SECRET_ACCESS_KEY is not set. "
            "Add it to your .env file before starting the service."
        )

    logger.info(
        "Creating Bedrock Runtime client — region: %s, key: %s…",
        settings.AWS_REGION,
        settings.AWS_ACCESS_KEY_ID[:8],  # log only the key prefix, never the full value
    )

    return boto3.client(
        "bedrock-runtime",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        # No aws_session_token — we use long-term IAM user credentials
    )


def validate_bedrock_connectivity(client) -> None:
    """
    Verify that the client can actually reach Bedrock and invoke the target model.

    Makes a minimal converse call (max 10 output tokens) that exercises the full
    auth + network + model-access path. Raises on any failure with a clear message
    describing what is wrong so the operator can fix it without reading AWS docs.

    Called once at service startup inside the FastAPI lifespan handler.
    """
    logger.info(
        "Validating Bedrock connectivity — model: %s, region: %s",
        settings.BEDROCK_MODEL_ID,
        settings.AWS_REGION,
    )

    try:
        client.converse(
            modelId=settings.BEDROCK_MODEL_ID,
            messages=[{"role": "user", "content": [{"text": "ping"}]}],
            inferenceConfig={"maxTokens": 10},
        )
        logger.info(
            "✅  Bedrock connectivity OK — model '%s' is reachable and responding.",
            settings.BEDROCK_MODEL_ID,
        )

    except NoCredentialsError:
        logger.error(
            "❌  No AWS credentials found. "
            "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env."
        )
        raise

    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        msg = exc.response["Error"]["Message"]

        if code in ("UnrecognizedClientException", "InvalidSignatureException",
                    "InvalidClientTokenId"):
            logger.error(
                "❌  Invalid AWS credentials (key ID or secret is wrong). "
                "Rotate the keys in IAM and update .env. AWS error: %s", msg
            )
        elif code == "AccessDeniedException":
            logger.error(
                "❌  Access denied to model '%s'. "
                "Go to the AWS Bedrock console → Model Access and enable this model "
                "in region '%s'. AWS error: %s",
                settings.BEDROCK_MODEL_ID, settings.AWS_REGION, msg,
            )
        elif code == "ResourceNotFoundException":
            logger.error(
                "❌  Model '%s' was not found in region '%s'. "
                "Check BEDROCK_MODEL_ID and AWS_REGION in .env.",
                settings.BEDROCK_MODEL_ID, settings.AWS_REGION,
            )
        elif code == "ValidationException":
            logger.error(
                "❌  Bedrock validation error — model ID may be incorrect: %s", msg
            )
        else:
            logger.error(
                "❌  Bedrock ClientError [%s]: %s", code, msg
            )
        raise

    except BotoCoreError as exc:
        logger.error(
            "❌  BotoCoreError reaching Bedrock — check AWS_REGION and network "
            "connectivity from inside the container. Error: %s", exc
        )
        raise


# Module-level singleton — created once when this module is first imported.
# Fails fast with a clear ValueError if credentials are missing.
bedrock_runtime = _create_bedrock_runtime_client()
