# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json* ./
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/backend/package.json ./apps/backend/package.json

# Install dependencies
RUN npm install

# Copy frontend source
COPY apps/frontend ./apps/frontend

# Build frontend
RUN npm run build --workspace=apps/frontend

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/frontend/package.json ./apps/frontend/package.json
COPY --from=builder /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=builder /app/apps/frontend/next.config.js ./apps/frontend/next.config.js
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=apps/frontend"]
