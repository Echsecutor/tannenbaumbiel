"""
Game world simulation for server-side multiplayer logic
"""
import asyncio
import time
from typing import Dict, List, Optional
from datetime import datetime
from uuid import uuid4
from random import choice

from app.network.protocol import PlayerState, EnemyState, ProjectileState, GameStateData, InputAction


class GameWorld:
    """Server-side game world simulation"""

    def __init__(self, room_id: str):
        self.room_id = room_id
        self.tick = 0
        self.last_update = time.time()

        # Game state
        self.players: Dict[str, PlayerState] = {}
        self.enemies: Dict[str, EnemyState] = {}
        self.projectiles: Dict[str, ProjectileState] = {}

        # Game constants (synced with client)
        self.world_width = 800
        self.world_height = 600
        self.gravity = 800
        self.ground_y = 700  # Match client platform at y=700

        # Physics constants
        self.player_speed = 200
        self.jump_speed = 550

        # Input tracking
        self.player_inputs: Dict[str, Dict[str, bool]] = {}  # player_id -> {action: pressed}

        # Authority tracking for conflict resolution
        self.object_authorities: Dict[str, str] = {}  # object_id -> player_id

        # Initialize enemies when world is created
        self.create_enemies()

    def add_player(self, player_id: str, username: str, x: float = 100, y: float = 650) -> PlayerState:
        """Add a new player to the world"""
        player_state = PlayerState(
            player_id=player_id,
            username=username,
            x=x,
            y=y,
            velocity_x=0,
            velocity_y=0,
            health=100,
            facing_right=True,
            is_grounded=True,
            is_jumping=False,
            is_shooting=False
        )

        self.players[player_id] = player_state
        self.player_inputs[player_id] = {}

        return player_state

    def remove_player(self, player_id: str) -> bool:
        """Remove player from world"""
        if player_id in self.players:
            del self.players[player_id]
            if player_id in self.player_inputs:
                del self.player_inputs[player_id]
            return True
        return False

    def handle_player_input(self, player_id: str, action: InputAction, pressed: bool):
        """Process player input"""
        if player_id not in self.player_inputs:
            self.player_inputs[player_id] = {}

        self.player_inputs[player_id][action] = pressed
        print(f"🎮 World {self.room_id}: Player {player_id} input {action}={pressed}")

        # Immediately handle shooting to be responsive
        if action == InputAction.SHOOT and pressed:
            self.create_projectile(player_id)

    def update(self, delta_time: float):
        """Update game world simulation"""
        self.tick += 1

        # Update players
        for player_id, player in self.players.items():
            self.update_player(player, delta_time)

        # Update enemies
        for enemy_id, enemy in self.enemies.items():
            self.update_enemy(enemy, delta_time)

        # Update projectiles
        projectiles_to_remove = []
        for proj_id, projectile in self.projectiles.items():
            self.update_projectile(projectile, delta_time)

            # Remove projectiles that are off-screen or expired
            if (projectile.x < -50 or projectile.x > self.world_width + 50 or
                    projectile.y > self.world_height + 50):
                projectiles_to_remove.append(proj_id)

        for proj_id in projectiles_to_remove:
            del self.projectiles[proj_id]

    def update_player(self, player: PlayerState, delta_time: float):
        """Update single player state"""
        inputs = self.player_inputs.get(player.player_id, {})

        # Movement
        if inputs.get(InputAction.MOVE_LEFT, False):
            player.velocity_x = -self.player_speed
            player.facing_right = False
        elif inputs.get(InputAction.MOVE_RIGHT, False):
            player.velocity_x = self.player_speed
            player.facing_right = True
        else:
            player.velocity_x = 0

        # Jumping
        if inputs.get(InputAction.JUMP, False) and player.is_grounded:
            player.velocity_y = -self.jump_speed
            player.is_grounded = False
            player.is_jumping = True

        # Apply gravity
        if not player.is_grounded:
            player.velocity_y += self.gravity * delta_time

        # Update position
        player.x += player.velocity_x * delta_time
        player.y += player.velocity_y * delta_time

        # Ground collision
        if player.y >= self.ground_y:
            player.y = self.ground_y
            player.velocity_y = 0
            player.is_grounded = True
            player.is_jumping = False

        # World boundaries
        player.x = max(16, min(self.world_width - 16, player.x))

    def update_projectile(self, projectile: ProjectileState, delta_time: float):
        """Update projectile position"""
        projectile.x += projectile.velocity_x * delta_time
        projectile.y += projectile.velocity_y * delta_time

        # Apply slight gravity to projectiles
        projectile.velocity_y += 200 * delta_time

    def create_projectile(self, player_id: str) -> Optional[str]:
        """Create a projectile from player"""
        if player_id not in self.players:
            return None

        player = self.players[player_id]

        # Create projectile
        projectile_id = str(uuid4())
        direction = 1 if player.facing_right else -1

        projectile = ProjectileState(
            projectile_id=projectile_id,
            x=player.x,
            y=player.y,
            velocity_x=direction * 400,
            velocity_y=-50,
            owner_id=player_id,
            damage=25
        )

        self.projectiles[projectile_id] = projectile
        # Set authority to the player who shot the projectile
        self.object_authorities[projectile_id] = player_id
        print(f"🎯 Created projectile {projectile_id} with authority to {player_id}")
        return projectile_id

    def create_enemies(self):
        """Create initial enemies in the world"""
        # Create enemies matching the client-side setup
        enemies_config = [
            {"id": "enemy_1", "type": "owlet", "x": 300, "y": 650, "health": 50},
            {"id": "enemy_2", "type": "owlet", "x": 600, "y": 650, "health": 50},
            {"id": "boss_1", "type": "pink_boss", "x": 800, "y": 650, "health": 100}
        ]

        for config in enemies_config:
            enemy = EnemyState(
                enemy_id=config["id"],
                enemy_type=config["type"],
                x=config["x"],
                y=config["y"],
                velocity_x=0,
                velocity_y=0,
                health=config["health"],
                facing_right=True
            )
            self.enemies[config["id"]] = enemy
            # Initialize authority based on closest player (if any)
            self.update_object_authority(config["id"], config["x"], config["y"])
            print(f"🦴 Created enemy: {config['id']} ({config['type']}) at ({config['x']}, {config['y']})")

    def update_enemy(self, enemy: EnemyState, delta_time: float):
        """Update single enemy state - only if we have authority"""
        # Update authority for this enemy
        self.update_object_authority(enemy.enemy_id, enemy.x, enemy.y)

        # Only update enemy AI if we have authority (closest player controls it)
        authority_player = self.get_object_authority(enemy.enemy_id)
        if not authority_player:
            return  # No players, no updates

        # Simple AI: Random movement with occasional direction changes
        if self.tick % 120 == 0:  # Change direction every 2 seconds (at 60fps)
            # Random chance to change direction or speed
            if enemy.enemy_type == "pink_boss":
                # Boss moves slower
                enemy.velocity_x = choice([-50, 0, 50])
            else:
                # Regular enemies
                enemy.velocity_x = choice([-100, -50, 0, 50, 100])

            enemy.facing_right = enemy.velocity_x >= 0

        # Apply gravity
        enemy.velocity_y += self.gravity * delta_time

        # Update position
        enemy.x += enemy.velocity_x * delta_time
        enemy.y += enemy.velocity_y * delta_time

        # Ground collision
        if enemy.y >= self.ground_y:
            enemy.y = self.ground_y
            enemy.velocity_y = 0

        # World boundaries (bounce off walls)
        if enemy.x <= 16:
            enemy.x = 16
            enemy.velocity_x = abs(enemy.velocity_x)  # Bounce right
            enemy.facing_right = True
        elif enemy.x >= self.world_width - 16:
            enemy.x = self.world_width - 16
            enemy.velocity_x = -abs(enemy.velocity_x)  # Bounce left
            enemy.facing_right = False

    def get_game_state(self) -> GameStateData:
        """Get current game state"""
        return GameStateData(
            room_id=self.room_id,
            tick=self.tick,
            players=list(self.players.values()),
            enemies=list(self.enemies.values()),
            projectiles=list(self.projectiles.values())
        )

    def has_players(self) -> bool:
        """Check if world has any players"""
        return len(self.players) > 0

    def resolve_object_authority(self, object_x: float, object_y: float) -> Optional[str]:
        """Return player_id of closest player to object position"""
        if not self.players:
            return None

        closest_player = None
        min_distance = float('inf')

        for player_id, player in self.players.items():
            distance = ((player.x - object_x)**2 + (player.y - object_y)**2)**0.5
            if distance < min_distance:
                min_distance = distance
                closest_player = player_id

        return closest_player

    def update_object_authority(self, object_id: str, object_x: float, object_y: float):
        """Update authority for an object based on closest player"""
        new_authority = self.resolve_object_authority(object_x, object_y)
        if new_authority:
            old_authority = self.object_authorities.get(object_id)
            if old_authority != new_authority:
                self.object_authorities[object_id] = new_authority
                print(f"🏆 Authority for {object_id} transferred from {old_authority} to {new_authority}")

    def get_object_authority(self, object_id: str) -> Optional[str]:
        """Get current authority for an object"""
        return self.object_authorities.get(object_id)

    def player_has_authority(self, player_id: str, object_id: str) -> bool:
        """Check if player has authority over an object"""
        return self.object_authorities.get(object_id) == player_id

    def update_player_from_client(self, player_id: str, client_player_data: dict):
        """Update player state from client (players have authority over themselves)"""
        if player_id not in self.players:
            return

        player = self.players[player_id]
        player.x = client_player_data.get('x', player.x)
        player.y = client_player_data.get('y', player.y)
        player.velocity_x = client_player_data.get('velocity_x', player.velocity_x)
        player.velocity_y = client_player_data.get('velocity_y', player.velocity_y)
        player.facing_right = client_player_data.get('facing_right', player.facing_right)
        player.is_grounded = client_player_data.get('is_grounded', player.is_grounded)
        player.is_jumping = client_player_data.get('is_jumping', player.is_jumping)
        player.health = client_player_data.get('health', player.health)

    def update_enemy_from_client(self, enemy_id: str, client_enemy_data: dict):
        """Update enemy state from client (only if client has authority)"""
        if enemy_id not in self.enemies:
            return

        enemy = self.enemies[enemy_id]
        enemy.x = client_enemy_data.get('x', enemy.x)
        enemy.y = client_enemy_data.get('y', enemy.y)
        enemy.velocity_x = client_enemy_data.get('velocity_x', enemy.velocity_x)
        enemy.velocity_y = client_enemy_data.get('velocity_y', enemy.velocity_y)
        enemy.facing_right = client_enemy_data.get('facing_right', enemy.facing_right)
        enemy.health = client_enemy_data.get('health', enemy.health)

    def update_projectile_from_client(self, projectile_id: str, client_projectile_data: dict):
        """Update or create projectile from client"""
        if projectile_id not in self.projectiles:
            # Create new projectile from client
            from uuid import uuid4
            projectile = ProjectileState(
                projectile_id=projectile_id,
                x=client_projectile_data.get('x', 0),
                y=client_projectile_data.get('y', 0),
                velocity_x=client_projectile_data.get('velocity_x', 0),
                velocity_y=client_projectile_data.get('velocity_y', 0),
                owner_id=client_projectile_data.get('owner_id', ''),
                damage=client_projectile_data.get('damage', 25)
            )
            self.projectiles[projectile_id] = projectile
            # Set authority to owner
            self.object_authorities[projectile_id] = projectile.owner_id
        else:
            # Update existing projectile
            projectile = self.projectiles[projectile_id]
            projectile.x = client_projectile_data.get('x', projectile.x)
            projectile.y = client_projectile_data.get('y', projectile.y)
            projectile.velocity_x = client_projectile_data.get('velocity_x', projectile.velocity_x)
            projectile.velocity_y = client_projectile_data.get('velocity_y', projectile.velocity_y)


class WorldManager:
    """Manages game worlds for all rooms"""

    def __init__(self):
        self.worlds: Dict[str, GameWorld] = {}
        self.update_task: Optional[asyncio.Task] = None
        self.running = False

    async def start(self):
        """Start the world update loop"""
        if not self.running:
            self.running = True
            self.update_task = asyncio.create_task(self.update_loop())

    async def stop(self):
        """Stop the world update loop"""
        self.running = False
        if self.update_task:
            self.update_task.cancel()
            try:
                await self.update_task
            except asyncio.CancelledError:
                pass

    def create_world(self, room_id: str) -> GameWorld:
        """Create a new game world"""
        world = GameWorld(room_id)
        self.worlds[room_id] = world
        return world

    def get_world(self, room_id: str) -> Optional[GameWorld]:
        """Get existing world"""
        return self.worlds.get(room_id)

    def remove_world(self, room_id: str) -> bool:
        """Remove world"""
        if room_id in self.worlds:
            del self.worlds[room_id]
            return True
        return False

    async def update_loop(self):
        """Main update loop for all worlds"""
        last_time = time.time()
        last_broadcast_time = time.time()
        broadcast_frequency = 1 / 30  # 30fps server broadcasts

        while self.running:
            current_time = time.time()
            delta_time = current_time - last_time
            last_time = current_time

            # Update all worlds
            worlds_to_remove = []
            for room_id, world in self.worlds.items():
                if world.has_players():
                    world.update(delta_time)
                else:
                    # Mark empty worlds for removal
                    worlds_to_remove.append(room_id)

            # Clean up empty worlds
            for room_id in worlds_to_remove:
                del self.worlds[room_id]

            # Broadcast game state at 30fps
            if current_time - last_broadcast_time >= broadcast_frequency:
                await self.broadcast_all_world_states()
                last_broadcast_time = current_time

            # Target 60 FPS (16.67ms per frame)
            await asyncio.sleep(1 / 60)

    async def broadcast_all_world_states(self):
        """Broadcast current game state to all players in all worlds"""
        # Import here to avoid circular import
        from app.api.websocket import connection_manager

        for room_id, world in self.worlds.items():
            if world.has_players():
                try:
                    await connection_manager.broadcast_game_state(room_id)
                except Exception as e:
                    print(f"❌ Error broadcasting game state for room {room_id}: {e}")


# Global world manager instance
world_manager = WorldManager()
