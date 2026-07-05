FROM node:20-slim

# Install build tools needed for native modules + curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install ALL dependencies (including devDependencies for Tailwind build)
# Use --include=dev to avoid "npm warn config production" from Render's NODE_ENV=production
RUN npm ci --include=dev

# Copy the rest of the code
COPY . .

# Build the production Tailwind CSS
RUN npm run build:css

# Remove dev dependencies to keep image small
RUN npm prune --production

# Persistent data volume (Render disk mounts at /app/data)
VOLUME /app/data

ENV NODE_ENV=production
ENV PORT=4174
ENV DEMO_MODE=false

EXPOSE 4174

# Healthcheck using curl (available after apt install)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:4174/health || exit 1

CMD ["node", "server.js"]
