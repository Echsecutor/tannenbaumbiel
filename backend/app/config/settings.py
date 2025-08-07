"""
Application configuration settings
"""
import os
from typing import List
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    app_name: str = "Tannenbaumbiel Game Server"
    debug: bool = True
    secret_key: str = "dev-secret-key"

    # Database
    database_url: str = "postgresql://user:password@localhost:5432/tannenbaumbiel_dev"

    # CORS
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000,https://tannenbaumbiel.echsecutables.de,https://server.tannenbaumbiel.echsecutables.de"

    @field_validator('allowed_origins')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v

    # Game Configuration
    max_players_per_room: int = 4
    game_tick_rate: int = 60
    physics_update_rate: int = 60

    # WebSocket
    websocket_heartbeat_interval: float = 30.0
    websocket_close_timeout: float = 10.0

    class Config:
        env_file = ".env"


settings = Settings()
