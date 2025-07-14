FROM node:18-alpine

# Install dependencies for better-sqlite3 and su-exec for privilege dropping
RUN apk add --no-cache python3 make g++ su-exec

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev --ignore-scripts

# Copy source code (includes config/config.yaml.example for reference)
COPY . .

# Copy entrypoint script and make it executable
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create template directory and copy sample config for auto-provisioning
RUN mkdir -p /app/.config-template && \
    cp /app/config/config.yaml.example /app/.config-template/config.yaml.example

# Change ownership of app directory to node user (already exists in node:18-alpine)
RUN chown -R node:node /app

# Create necessary directories
RUN mkdir -p data logs config

# Expose port (if needed for health checks)
EXPOSE 3000

# Set entrypoint to handle config provisioning
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command
CMD ["npm", "start"] 