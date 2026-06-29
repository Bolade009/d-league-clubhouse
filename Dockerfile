FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

RUN npm ci --only=production

# Copy the rest
COPY . .

# Create data dir (will be volume in production)
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=4174
ENV DEMO_MODE=false

EXPOSE 4174

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4174/health || exit 1

CMD ["node", "server.js"]
