import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Huawei Network Manager"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEMO_MODE: bool = True

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "sqlite:///./huawei_manager.db"
    )
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY",
        "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7",
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # 32-byte URL-safe base64 key for Fernet encryption of SSH credentials at rest
    CREDENTIALS_ENCRYPTION_KEY: str = os.getenv(
        "CREDENTIALS_ENCRYPTION_KEY",
        "T2xpdmVpcmFIdWF3ZWlOZXR3b3JrTWFuYWdlcjIwMjY=",
    )

    SSH_DEFAULT_TIMEOUT: int = 15
    AUTO_SAVE_CONFIG_ON_SUCCESS: bool = True
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080"

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()

