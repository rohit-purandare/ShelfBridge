# Use Debian-based image instead of Alpine to fix better-sqlite3 compatibility
# Alpine uses musl libc which causes fcntl64 symbol issues with better-sqlite3
FROM node:20-slim

# Install dependencies for native modules and gosu for privilege dropping
# Use Debian package manager instead of Alpine's apk
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    gosu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies with native module compilation from source
# Use environment variables to ensure glibc compatibility and avoid prebuilt binaries
ENV npm_config_build_from_source=true \
    npm_config_better_sqlite3_binary_host_mirror="" \
    npm_config_sqlite3_binary_host_mirror="" \
    npm_config_target_platform=linux \
    PYTHON=/usr/bin/python3

# Install dependencies and build native modules with comprehensive validation
RUN set -e && \
    echo "🔧 Installing dependencies..." && \
    npm cache clean --force && \
    npm ci --omit=dev --ignore-scripts && \
    echo "🔧 Building better-sqlite3 from source..." && \
    npm rebuild better-sqlite3 --verbose && \
    echo "🧪 COMPREHENSIVE BETTER-SQLITE3 TESTING:" && \
    echo "Test 1: Basic module loading..." && \
    node -e "const db = require('better-sqlite3'); console.log('✅ Module loads successfully');" && \
    echo "Test 2: In-memory database creation..." && \
    node -e "const db = require('better-sqlite3')(':memory:'); console.log('✅ In-memory DB works');" && \
    echo "Test 3: Table creation and operations..." && \
    node -e "const db = require('better-sqlite3')(':memory:'); db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)'); console.log('✅ Table creation works');" && \
    echo "Test 4: Insert and query operations..." && \
    node -e "const db = require('better-sqlite3')(':memory:'); db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)'); const stmt = db.prepare('INSERT INTO test (name) VALUES (?)'); stmt.run('test'); const row = db.prepare('SELECT * FROM test WHERE name = ?').get('test'); if (row.name !== 'test') throw new Error('Query failed'); console.log('✅ Insert/Query operations work');" && \
    echo "Test 5: File database operations..." && \
    node -e "const db = require('better-sqlite3')('/tmp/test.db'); db.exec('CREATE TABLE test (id INTEGER)'); db.exec('INSERT INTO test (id) VALUES (1)'); const count = db.prepare('SELECT COUNT(*) as count FROM test').get().count; if (count !== 1) throw new Error('File DB failed'); db.close(); require('fs').unlinkSync('/tmp/test.db'); console.log('✅ File database operations work');" && \
    echo "Test 6: Transaction support..." && \
    node -e "const db = require('better-sqlite3')(':memory:'); db.exec('CREATE TABLE test (id INTEGER)'); const transaction = db.transaction(() => { db.prepare('INSERT INTO test (id) VALUES (?)').run(1); db.prepare('INSERT INTO test (id) VALUES (?)').run(2); }); transaction(); const count = db.prepare('SELECT COUNT(*) as count FROM test').get().count; if (count !== 2) throw new Error('Transaction failed'); console.log('✅ Transaction support works');" && \
    echo "Test 7: Prepared statements with parameters..." && \
    node -e "const db = require('better-sqlite3')(':memory:'); db.exec('CREATE TABLE test (id INTEGER, value TEXT)'); const insert = db.prepare('INSERT INTO test (id, value) VALUES (?, ?)'); insert.run(1, 'hello'); insert.run(2, 'world'); const rows = db.prepare('SELECT * FROM test ORDER BY id').all(); if (rows.length !== 2 || rows[0].value !== 'hello') throw new Error('Prepared statements failed'); console.log('✅ Prepared statements work');" && \
    echo "🎉 ALL BETTER-SQLITE3 TESTS PASSED - MODULE IS FULLY FUNCTIONAL!" && \
    echo "🎯 BETTER-SQLITE3 IS NOW BULLETPROOF AND PRODUCTION-READY!"

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
# The node user already exists in the node:20-slim image, just set ownership
RUN mkdir -p logs && \
    chown -R node:node /app

# Add comprehensive health check to ensure better-sqlite3 is always working
# This performs multiple operations to catch any runtime issues
HEALTHCHECK --interval=30s --timeout=15s --start-period=20s --retries=3 \
    CMD node -e " \
        try { \
            const db = require('better-sqlite3')(':memory:'); \
            db.exec('CREATE TABLE health_check (id INTEGER PRIMARY KEY, timestamp TEXT)'); \
            const stmt = db.prepare('INSERT INTO health_check (timestamp) VALUES (?)'); \
            stmt.run(new Date().toISOString()); \
            const count = db.prepare('SELECT COUNT(*) as count FROM health_check').get().count; \
            if (count !== 1) throw new Error('Health check failed'); \
            db.close(); \
        } catch (e) { \
            console.error('better-sqlite3 health check failed:', e.message); \
            process.exit(1); \
        }" || exit 1

# Expose port (if needed for health checks)
EXPOSE 3000

# Set entrypoint to handle config provisioning and native module validation
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command
CMD ["npm", "start"] 