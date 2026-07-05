FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for Tailwind build)
RUN npm ci

# Copy the rest of the code
COPY . .

# Build the production Tailwind CSS
RUN npm run build:css

# Remove dev dependencies to keep image small
RUN npm prune --production

# Create data folder
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=4174
ENV DEMO_MODE=false

EXPOSE 4174

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4174/health || exit 1

CMD ["node", "server.js"]
