FROM node:20-alpine

# Install dependencies for native modules and su-exec for privilege dropping
RUN apk add --no-cache python3 make g++ su-exec

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies with comprehensive native module compilation
# Force compilation from source instead of using prebuilt binaries
# Set environment variables to ensure source compilation
ENV npm_config_build_from_source=true
RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild --verbose && \
    npm cache clean --force

# Copy source code (includes config/config.yaml.example for reference)
COPY . .

# Copy entrypoint script and make it executable
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create template directory and copy sample config for auto-provisioning
# Only copy if the file exists (for development builds)
RUN mkdir -p /app/.config-template && \
    if [ -f "/app/config/config.yaml.example" ]; then \
        cp /app/config/config.yaml.example /app/.config-template/config.yaml.example; \
    else \
        echo "# Sample configuration file" > /app/.config-template/config.yaml.example; \
        echo "# Copy this file to config.yaml and edit with your credentials" >> /app/.config-template/config.yaml.example; \
    fi

# Create logs directory (config and data are handled by volume mounts)
RUN mkdir -p logs && \
    # Change ownership of app directory to node user (already exists in node:20-alpine)
    chown -R node:node /app

# Add health check to ensure the application and native modules are working properly
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD npm run test:native > /dev/null 2>&1 || exit 1

# Expose port (if needed for health checks)
EXPOSE 3000

# Set entrypoint to handle config provisioning and native module validation
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command
CMD ["npm", "start"] 