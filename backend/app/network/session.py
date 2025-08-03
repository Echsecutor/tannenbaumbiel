"""
Session management for WebSocket connections using PostgreSQL
"""
import uuid
from typing import Optional
from datetime import datetime, timedelta
from uuid import UUID

from app.database.repository import GameRepository
from app.database.models import Player


class SessionManager:
    """Manages user sessions using PostgreSQL backend"""

    def generate_session_id(self) -> str:
        """Generate a unique session ID"""
        return str(uuid.uuid4())

    def create_session(self, username: str = None) -> str:
        """Create a new session and return session ID"""
        session_id = self.generate_session_id()

        with GameRepository() as repo:
            # Check if player exists by username
            if username:
                player = repo.get_player_by_username(username)
                if player:
                    # Update existing player's session
                    repo.update_player_session(player.id, session_id)
                else:
                    # Create new player
                    repo.create_player(username=username, session_id=session_id)
            else:
                # Anonymous player
                repo.create_player(username=f"Guest_{session_id[:8]}", session_id=session_id)

        return session_id

    def get_player_by_session(self, session_id: str) -> Optional[Player]:
        """Get player by session ID"""
        with GameRepository() as repo:
            return repo.get_player_by_session_id(session_id)

    def update_session_activity(self, session_id: str):
        """Update session activity (last seen timestamp)"""
        with GameRepository() as repo:
            player = repo.get_player_by_session_id(session_id)
            if player:
                repo.update_player_last_seen(player.id)

    def remove_session(self, session_id: str):
        """Remove session by clearing session_id from player"""
        with GameRepository() as repo:
            player = repo.get_player_by_session_id(session_id)
            if player:
                # Clear the session_id instead of deleting the player
                repo.update_player_session(player.id, None)

    def cleanup_expired_sessions(self, timeout_minutes: int = 30) -> int:
        """Clean up expired sessions using repository cleanup"""
        timeout_hours = timeout_minutes / 60.0
        with GameRepository() as repo:
            return repo.cleanup_old_sessions(hours_ago=int(timeout_hours))

    def is_session_valid(self, session_id: str) -> bool:
        """Check if session is valid and not expired"""
        player = self.get_player_by_session(session_id)
        if not player or not player.session_id:
            return False

        # Check if last seen is within timeout
        timeout = timedelta(minutes=30)
        return (datetime.utcnow() - player.last_seen) < timeout
