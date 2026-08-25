# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json

RUN npm install

COPY apps/backend ./apps/backend
COPY apps/frontend ./apps/frontend

RUN npm run build --workspace=apps/backend

# Production stage
FROM node:20-alpine AS backend-prod
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json* ./

RUN npm install --omit=dev

EXPOSE 3001
CMD ["node", "apps/backend/dist/main.js"]
