# Multi-stage Dockerfile for MechHelp CRM (Vite React + Express API)
# Stage 1: Build Frontend
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies for build
RUN npm ci

# Copy source code and build configuration
COPY . .

# Build frontend to /app/dist
RUN npm run build

# Stage 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend, static assets, and built frontend
COPY backend ./backend
COPY shared ./shared
COPY supabase ./supabase
COPY --from=builder /app/dist ./dist

# Expose backend & frontend port
EXPOSE 8000

# Start application
CMD ["node", "backend/src/server.js"]
