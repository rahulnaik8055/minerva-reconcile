# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json* ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json

# Install all dependencies
RUN npm install

# Copy source files
COPY apps/backend ./apps/backend
COPY apps/frontend ./apps/frontend

# Build backend
RUN npm run build --workspace=apps/backend

# Production stage for backend
FROM node:20-alpine AS backend-prod
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json

EXPOSE 3001
CMD ["node", "apps/backend/dist/main.js"]
