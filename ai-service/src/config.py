from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # AWS credentials — must be set explicitly in .env.
    # No default credential chain, IAM roles, or instance profiles are used.
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"

    # Bedrock model — must have model access enabled in the Bedrock console.
    # Supported options:
    #   amazon.nova-lite-v1:0   — fast, supports tool use (recommended)
    #   amazon.nova-pro-v1:0    — highest quality
    #   anthropic.claude-3-5-haiku-20241022-v1:0  — fallback
    BEDROCK_MODEL_ID: str = "amazon.nova-lite-v1:0"

    # Inter-service URLs (injected via docker-compose environment block, not .env)
    PRODUCT_SERVICE_URL: str = "http://product-service:3002"
    ORDER_SERVICE_URL: str = "http://order-service:3003"

    # JWT secret — must match the value used by user-service
    JWT_SECRET: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
