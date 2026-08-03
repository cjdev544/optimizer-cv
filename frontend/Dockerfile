# Build context is the repo root (see docker-compose.yml) — same npm
# workspaces reasoning as backend/Dockerfile. This only builds the web app
# (vite build). The Chrome extension (dist-extension) is a browser-loaded
# artifact, not a running service, so it isn't part of this image.

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

COPY frontend frontend

ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace frontend

FROM nginx:alpine AS runner
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
