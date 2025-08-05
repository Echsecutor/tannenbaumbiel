# Frontend Production Dockerfile
# Multi-stage build: Build the app, then serve with nginx

# Stage 1: Build the application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --silent

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy the built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 1001 -S nginx \
    && adduser -S frontend -u 1001 -G nginx \
    && chown -R frontend:nginx /usr/share/nginx/html \
    && chown -R frontend:nginx /var/cache/nginx \
    && chown -R frontend:nginx /var/log/nginx \
    && chown -R frontend:nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown -R frontend:nginx /var/run/nginx.pid

USER frontend

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]