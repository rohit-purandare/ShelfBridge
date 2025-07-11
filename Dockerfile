FROM node:18-alpine

# Install dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev --ignore-scripts

# Copy source code
COPY . .

# Change ownership of app directory to node user (already exists in node:18-alpine)
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Create data directory
RUN mkdir -p data

# Expose port (if needed for health checks)
EXPOSE 3000

# Default command
CMD ["npm", "start"] 