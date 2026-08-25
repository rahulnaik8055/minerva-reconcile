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

# Copy Drizzle config, schema, and migrations for runtime db push
COPY apps/backend/drizzle.config.ts ./apps/backend/drizzle.config.ts
COPY apps/backend/src/database/schema ./apps/backend/src/database/schema
COPY apps/backend/drizzle ./apps/backend/drizzle

# Install drizzle-kit and drizzle-orm for runtime migrations
RUN npm install drizzle-kit drizzle-orm --no-save

EXPOSE 3001
CMD ["sh", "-c", "cd apps/backend && npx drizzle-kit push && cd /app && node apps/backend/dist/main.js"]
