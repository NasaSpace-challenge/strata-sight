# StrataSight: one container for the whole app (Express API + built React UI) for Google Cloud Run.
#   docker build -t stratasight .
#   docker run --rm -p 8080:8080 --env-file backend/.env.local stratasight

# ---- 1. build the React app --------------------------------------------------
FROM node:24-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci --workspace=frontend --include-workspace-root=false
COPY frontend frontend
RUN npm run build --workspace=frontend

# ---- 2. production-only backend dependencies ----------------------------------
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci --omit=dev --workspace=backend --include-workspace-root=false

# ---- 3. runtime ----------------------------------------------------------------
FROM node:24-slim
ENV NODE_ENV=production \
    API_BACKEND_HOST=0.0.0.0
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend ./backend
COPY --from=web /app/frontend/dist ./frontend/dist
# Live cache of agency responses is written next to the app; the node user must own it.
RUN mkdir -p /app/data-cache /app/backend/imagery-cache && chown -R node:node /app/data-cache /app/backend/imagery-cache
USER node
WORKDIR /app/backend
# Cloud Run sets PORT (8080); the server reads it.
EXPOSE 8080
CMD ["node", "server.js"]
