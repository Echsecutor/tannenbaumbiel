"""
FastAPI main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config.settings import settings
from app.api.websocket import router as websocket_router, startup_event, shutdown_event
from app.api.rest import router as rest_router
from app.database.connection import init_database, close_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print(f"Starting {settings.app_name}")

    # Initialize database connection
    print("Initializing database connection...")
    init_database()
    print("Database initialized successfully")

    # Initialize world manager
    print("Starting world manager...")
    await startup_event()
    print("World manager started successfully")

    yield

    # Shutdown
    print(f"Shutting down {settings.app_name}")

    # Stop world manager
    print("Stopping world manager...")
    await shutdown_event()
    print("World manager stopped")

    # Close database connections
    print("Closing database connections...")
    close_database()
    print("Database connections closed")


def create_app() -> FastAPI:
    """Create and configure FastAPI application"""

    app = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        lifespan=lifespan
    )

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(websocket_router, prefix="/ws")
    app.include_router(rest_router, prefix="/api/v1")

    return app


# Create app instance
app = create_app()


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": f"Welcome to {settings.app_name}",
        "status": "healthy",
        "debug": settings.debug
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info"
    )
