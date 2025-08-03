"""
Session management for WebSocket connections
"""
import uuid
from typing import Dict, Optional
from datetime import datetime, timedelta


class Session:
    """Represents a user session"""

    def __init__(self, session_id: str, username: str = None):
        self.session_id = session_id
        self.username = username
        self.created_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        self.room_id: Optional[str] = None

    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = datetime.utcnow()

    def is_expired(self, timeout_minutes: int = 30) -> bool:
        """Check if session is expired"""
        expiry_time = self.last_activity + timedelta(minutes=timeout_minutes)
        return datetime.utcnow() > expiry_time


class SessionManager:
    """Manages user sessions"""

    def __init__(self):
        self.sessions: Dict[str, Session] = {}

    def generate_session_id(self) -> str:
        """Generate a unique session ID"""
        return str(uuid.uuid4())

    def create_session(self, username: str = None) -> Session:
        """Create a new session"""
        session_id = self.generate_session_id()
        session = Session(session_id, username)
        self.sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[Session]:
        """Get session by ID"""
        return self.sessions.get(session_id)

    def update_session_activity(self, session_id: str):
        """Update session activity"""
        session = self.get_session(session_id)
        if session:
            session.update_activity()

    def remove_session(self, session_id: str):
        """Remove session"""
        if session_id in self.sessions:
            del self.sessions[session_id]

    def cleanup_expired_sessions(self, timeout_minutes: int = 30):
        """Remove expired sessions"""
        expired_sessions = [
            session_id for session_id, session in self.sessions.items()
            if session.is_expired(timeout_minutes)
        ]

        for session_id in expired_sessions:
            self.remove_session(session_id)

        return len(expired_sessions)
