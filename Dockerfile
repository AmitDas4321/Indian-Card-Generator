# ==============================================================================
# Multi-Stage Dockerfile for Indian Card Generator
# Target: Production-Ready, Secure, Minimal footprint (<180MB)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend SPA & Bundle Backend Server
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source code and build configs
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY server.ts ./

# Run production build (Vite client SPA -> dist/ + esbuild server.ts -> dist/server.cjs)
ENV NODE_ENV=production
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Install Production Dependencies Only
# ------------------------------------------------------------------------------
FROM node:22-alpine AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ------------------------------------------------------------------------------
# Stage 3: Minimal Production Runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3000

# Install dumb-init or wget for reliable process signal management and health checks
RUN apk add --no-cache wget

# Create application directory structure and permissions
RUN chown -R node:node /app

# Copy production node_modules from prod-deps stage
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules

# Copy compiled distribution artifacts and package metadata from builder stage
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/package.json ./package.json

# Drop root privileges - Run as built-in non-root 'node' user for security
USER node

# Expose default application port
EXPOSE 3000

# Container Healthcheck (polls the /api/health endpoint)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Start the bundled production server
CMD ["node", "dist/server.cjs"]
