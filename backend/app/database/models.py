"""
SQLAlchemy models for Tannenbaumbiel game
"""
from datetime import datetime
from uuid import uuid4, UUID
from typing import Optional

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, UUID as SqlUUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

Base = declarative_base()


class GameRoom(Base):
    """Game room model"""
    __tablename__ = "game_rooms"

    id = Column(SqlUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    max_players = Column(Integer, default=4)
    is_active = Column(Boolean, default=True)

    # Relationships
    game_sessions = relationship("GameSession", back_populates="room", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<GameRoom(id='{self.id}', name='{self.name}', active={self.is_active})>"


class Player(Base):
    """Player model"""
    __tablename__ = "players"

    id = Column(SqlUUID(as_uuid=True), primary_key=True, default=uuid4)
    username = Column(String(50), nullable=False)
    session_id = Column(String(100), unique=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen = Column(DateTime(timezone=True), server_default=func.now())
    total_score = Column(Integer, default=0)
    games_played = Column(Integer, default=0)

    # Relationships
    game_sessions = relationship("GameSession", back_populates="player", cascade="all, delete-orphan")
    game_stats = relationship("GameStat", back_populates="player", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Player(id='{self.id}', username='{self.username}', total_score={self.total_score})>"


class GameSession(Base):
    """Game session model - represents a player's participation in a room"""
    __tablename__ = "game_sessions"

    id = Column(SqlUUID(as_uuid=True), primary_key=True, default=uuid4)
    room_id = Column(SqlUUID(as_uuid=True), ForeignKey("game_rooms.id", ondelete="CASCADE"), nullable=False)
    player_id = Column(SqlUUID(as_uuid=True), ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    left_at = Column(DateTime(timezone=True), nullable=True)
    score = Column(Integer, default=0)
    character_type = Column(String(50), default="hero1")

    # Relationships
    room = relationship("GameRoom", back_populates="game_sessions")
    player = relationship("Player", back_populates="game_sessions")
    game_stats = relationship("GameStat", back_populates="session", cascade="all, delete-orphan")

    @property
    def is_active(self) -> bool:
        """Check if session is currently active (not left)"""
        return self.left_at is None

    def __repr__(self):
        return f"<GameSession(id='{self.id}', room_id='{self.room_id}', player_id='{self.player_id}', active={self.is_active})>"


class GameStat(Base):
    """Game statistics model"""
    __tablename__ = "game_stats"

    id = Column(SqlUUID(as_uuid=True), primary_key=True, default=uuid4)
    player_id = Column(SqlUUID(as_uuid=True), ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(SqlUUID(as_uuid=True), ForeignKey("game_sessions.id", ondelete="CASCADE"), nullable=False)
    stat_type = Column(String(50), nullable=False)
    stat_value = Column(Integer, nullable=False)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    player = relationship("Player", back_populates="game_stats")
    session = relationship("GameSession", back_populates="game_stats")

    def __repr__(self):
        return f"<GameStat(id='{self.id}', type='{self.stat_type}', value={self.stat_value})>"
