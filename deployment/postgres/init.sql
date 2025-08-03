-- PostgreSQL Initialization Script for Tannenbaumbiel
-- This script sets up the initial database schema
-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Game rooms table
CREATE TABLE IF NOT EXISTS game_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    max_players INTEGER DEFAULT 4,
    is_active BOOLEAN DEFAULT TRUE
);

-- Players table  
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL,
    session_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_score INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0
);

-- Game sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    score INTEGER DEFAULT 0,
    character_type VARCHAR(50) DEFAULT 'hero1'
);

-- Game statistics table
CREATE TABLE IF NOT EXISTS game_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    stat_type VARCHAR(50) NOT NULL,
    stat_value INTEGER NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_game_rooms_name ON game_rooms(name);

CREATE INDEX IF NOT EXISTS idx_game_rooms_active ON game_rooms(is_active);

CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);

CREATE INDEX IF NOT EXISTS idx_players_session ON players(session_id);

CREATE INDEX IF NOT EXISTS idx_game_sessions_room ON game_sessions(room_id);

CREATE INDEX IF NOT EXISTS idx_game_sessions_player ON game_sessions(player_id);

CREATE INDEX IF NOT EXISTS idx_game_stats_player ON game_stats(player_id);

CREATE INDEX IF NOT EXISTS idx_game_stats_type ON game_stats(stat_type);

-- Sample data for development
INSERT INTO
    game_rooms (name, max_players)
VALUES
    ('Winterwald', 4),
    ('Testworld', 2) ON CONFLICT DO NOTHING;

-- Print success message
DO $ $ BEGIN RAISE NOTICE 'Tannenbaumbiel database initialized successfully!';

END $ $;