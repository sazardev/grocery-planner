# ============================================================
# Grocery Planner — imagen self-hosted (fase 2)
#
# Un solo contenedor: sirve el frontend compilado (SPA) y el API
# HTTP (Rust + axum) en el puerto 8787. Los datos viven en /data.
#
#   docker build -t grocery-planner .
#   docker run -p 8787:8787 -v gp-data:/data grocery-planner
# ============================================================

# --- Etapa 1: build del frontend (React + Vite) -----------------------------
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY src ./src
COPY public ./public
RUN npm run build

# --- Etapa 2: build del backend (Rust + axum, feature server) ----------------
FROM rust:1.77-slim AS backend
WORKDIR /app
COPY src-tauri ./src-tauri
COPY Cargo.lock ./
RUN apt-get update && apt-get install -y --no-install-recommends \
    libwebkit2gtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && cargo build --release --features server --bin server --manifest-path src-tauri/Cargo.toml

# --- Etapa 3: runtime --------------------------------------------------------
FROM debian:bookworm-slim AS runtime
ENV GROCERY_PLANNER_PORT=8787 \
    GROCERY_PLANNER_DATA=/data/data.json \
    GROCERY_PLANNER_DIST=/app/dist
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=backend /app/src-tauri/target/release/server /usr/local/bin/grocery-server
COPY --from=frontend /app/dist ./dist
VOLUME ["/data"]
EXPOSE 8787
CMD ["grocery-server"]
