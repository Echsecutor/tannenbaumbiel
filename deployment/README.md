# Production Deployment Guide

This guide explains how to deploy Tannenbaumbiel in production using Docker Compose.

## Files Overview

- `docker-compose.prod.yml` - Production Docker Compose configuration
- `frontend/Dockerfile` - Production frontend Dockerfile (builds and serves with nginx)
- `frontend/nginx.conf` - Nginx configuration for serving the frontend
- `backend/Dockerfile` - Production backend Dockerfile (no hot reload)

## Quick Start

1. **Create environment file:**

   ```bash
   cp .env.prod.example .env.prod
   # Edit .env.prod with your production values
   ```

2. **Build and start services:**

   ```bash
   docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
   ```

3. **Check service health:**
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   docker-compose -f docker-compose.prod.yml logs
   ```

## Environment Variables

Create a `.env.prod` file with the following variables:

```bash
# Database
POSTGRES_PASSWORD=your_secure_database_password_here

# Backend
SECRET_KEY=your_very_long_random_secret_key_here_at_least_32_characters
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Frontend API URLs (update with your actual domain)
API_URL=https://api.yourdomain.com
WS_URL=wss://api.yourdomain.com/ws

# For localhost testing, use:
# API_URL=http://localhost:8000
# WS_URL=ws://localhost:8000/ws
```

## Production Features

### Frontend

- **Multi-stage build:** Builds TypeScript/Vite app and serves with nginx
- **Static file serving:** Optimized for production with gzip compression
- **Client-side routing:** Handles SPA routing correctly
- **API proxying:** Can proxy API and WebSocket requests through nginx
- **Security headers:** Includes basic security headers
- **Caching:** Static assets cached for 1 year

### Backend

- **Multi-worker:** Runs with 4 uvicorn workers for better performance
- **No hot reload:** Production-optimized startup
- **Health checks:** Proper health checking for container orchestration
- **Security:** Runs as non-root user

### Database

- **Production database:** Separate from development database
- **Persistent storage:** Data persisted in Docker volumes
- **Resource limits:** Memory limits set for production

### Additional Services

- **Redis:** Added for session storage and caching (optional)
- **Health checks:** All services have proper health checks
- **Restart policies:** Services restart automatically on failure

## Security Considerations

1. **Change default passwords:** Update `POSTGRES_PASSWORD` and `SECRET_KEY`
2. **CORS configuration:** Set `ALLOWED_ORIGINS` to your actual domain(s)
3. **SSL/TLS:** Consider adding SSL termination (nginx or load balancer)
4. **Network security:** Consider using Docker networks for internal communication
5. **Secrets management:** Consider using Docker secrets or external secret management

## Scaling

### Horizontal Scaling

- **Backend:** Increase worker count or run multiple backend containers
- **Database:** Consider read replicas for heavy read workloads
- **Redis:** Can be used for session sharing across multiple backend instances

### Load Balancing

Add a load balancer (nginx, HAProxy, or cloud LB) in front of the services:

```yaml
# Add to docker-compose.prod.yml
nginx-lb:
  image: nginx:alpine
  ports:
    - "443:443"
    - "80:80"
  volumes:
    - ./deployment/nginx/load-balancer.conf:/etc/nginx/nginx.conf
    - ./ssl:/etc/ssl/certs
  depends_on:
    - frontend
    - backend
```

## Monitoring

Consider adding monitoring services:

```yaml
# Optional monitoring stack
prometheus:
  image: prom/prometheus
  ports:
    - "9090:9090"

grafana:
  image: grafana/grafana
  ports:
    - "3000:3000"
```

## Backup

Regular database backups:

```bash
# Create backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U tannenbaum tannenbaumbiel_prod > backup.sql

# Restore backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U tannenbaum tannenbaumbiel_prod < backup.sql
```

## Logs

View logs:

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f postgres
```

## Troubleshooting

### Service won't start

1. Check logs: `docker-compose -f docker-compose.prod.yml logs [service]`
2. Check health: `docker-compose -f docker-compose.prod.yml ps`
3. Verify environment variables in `.env.prod`

### Database connection issues

1. Verify `DATABASE_URL` format
2. Check postgres service is healthy
3. Verify network connectivity between services

### Frontend not loading

1. Check nginx logs: `docker-compose -f docker-compose.prod.yml logs frontend`
2. Verify build completed successfully
3. Check API URL configuration matches backend service

## Development vs Production

| Aspect          | Development                | Production                    |
| --------------- | -------------------------- | ----------------------------- |
| **Frontend**    | Hot reload, source mounted | Built static files, nginx     |
| **Backend**     | Hot reload, source mounted | Multi-worker, no reload       |
| **Database**    | Dev credentials, dev DB    | Secure credentials, prod DB   |
| **Volumes**     | Source code mounted        | Only data volumes             |
| **Environment** | DEBUG=True                 | DEBUG=False                   |
| **Security**    | Relaxed CORS               | Strict CORS, security headers |
