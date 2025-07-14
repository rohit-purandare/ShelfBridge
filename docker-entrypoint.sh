#!/bin/sh
set -e

# Function to check if all native modules are working
check_native_modules() {
    echo "🔍 Checking native modules..."
    
    # Check for any native modules in node_modules
    if find /app/node_modules -name "*.node" -type f 2>/dev/null | grep -q .; then
        echo "🔍 Found native modules, testing compatibility..."
        # Try to require all .node files to check for issues
        for node_file in $(find /app/node_modules -name "*.node" -type f 2>/dev/null); do
            module_name=$(basename "$node_file" .node)
            if node -e "require('$node_file')" 2>/dev/null; then
                echo "✅ $module_name native module is working"
            else
                echo "❌ $module_name native module is not working"
                return 1
            fi
        done
        echo "✅ All native modules are working correctly"
    else
        echo "ℹ️  No native modules found"
    fi
    
    return 0
}

# Function to rebuild all native modules
rebuild_native_modules() {
    echo "🔧 Rebuilding all native modules..."
    
    # Rebuild all native modules
    if npm rebuild; then
        echo "✅ Native module rebuild successful"
        return 0
    else
        echo "❌ Native module rebuild failed"
        return 1
    fi
}

# Check native modules on startup
if ! check_native_modules; then
    echo ""
    echo "🚨 NATIVE MODULE ERROR DETECTED"
    echo ""
    echo "One or more native modules are not working properly."
    echo "This usually happens when:"
    echo "  • The container was built on a different architecture"
    echo "  • Dependencies weren't installed correctly"
    echo "  • Node.js version mismatch"
    echo "  • Missing system dependencies"
    echo ""
    echo "🔧 ATTEMPTING TO FIX..."
    echo ""
    
    # Try to rebuild all native modules
    if rebuild_native_modules; then
        echo "✅ Rebuild successful"
        if check_native_modules; then
            echo "✅ All native modules are now working"
        else
            echo "❌ Rebuild failed to fix the issue"
            echo ""
            echo "Please try:"
            echo "  1. Rebuild the Docker image: docker-compose build --no-cache"
            echo "  2. Or pull the latest image: docker pull ghcr.io/rohit-purandare/shelfbridge:latest"
            echo "  3. Check if your system has the required build tools"
            echo ""
            exit 1
        fi
    else
        echo "❌ Failed to rebuild native modules"
        echo ""
        echo "Please rebuild the Docker image:"
        echo "  docker-compose build --no-cache"
        echo ""
        echo "Or check your system for required build dependencies:"
        echo "  - python3, make, g++ (for Alpine Linux)"
        echo "  - build-essential (for Ubuntu/Debian)"
        echo ""
        exit 1
    fi
fi

# Always ensure config directory exists
mkdir -p /app/config

# Copy sample config if it doesn't exist (handles both mounted and non-mounted scenarios)
if [ ! -f "/app/config/config.yaml.example" ]; then
    echo "📋 Copying sample config to config directory..."
    cp /app/.config-template/config.yaml.example /app/config/config.yaml.example
    echo "✅ Sample config available at ./config/config.yaml.example"
fi

# Auto-create config.yaml from example if it doesn't exist
if [ ! -f "/app/config/config.yaml" ]; then
    echo "🔧 Creating config.yaml from example template..."
    cp /app/config/config.yaml.example /app/config/config.yaml
    echo "✅ Created config.yaml - please edit it with your API credentials"
    echo "💡 Container will restart automatically when you save changes to config.yaml"
    echo "📝 Edit: ./config/config.yaml"
    
    # If no volumes are mounted, provide helpful instructions
    if [ ! -w "/app/config" ] || ! mountpoint -q /app/config 2>/dev/null; then
        echo ""
        echo "🚀 QUICK START OPTIONS:"
        echo ""
        echo "1️⃣  Set credentials via environment variables:"
        echo "   docker run -e ABS_URL=https://your-abs.com -e ABS_TOKEN=abc123 -e HARDCOVER_TOKEN=xyz789 ghcr.io/rohit-purandare/shelfbridge:latest"
        echo ""
        echo "2️⃣  Mount a config directory for persistent editing:"
        echo "   docker run -v ./config:/app/config ghcr.io/rohit-purandare/shelfbridge:latest"
        echo ""
        echo "3️⃣  Use Docker Compose for full setup:"
        echo "   curl -o docker-compose.yml https://raw.githubusercontent.com/rohit-purandare/ShelfBridge/main/docker-compose.yml"
        echo "   docker-compose up -d"
        echo ""
    fi
fi

# Check if config.yaml still contains placeholder values
if [ -f "/app/config/config.yaml" ]; then
    echo "🔍 Checking configuration for placeholder values..."
    
    # Check for common placeholder patterns
    if grep -q "your-audiobookshelf-server.com\|your_audiobookshelf_api_token\|your_hardcover_api_token\|your_username" /app/config/config.yaml; then
        echo ""
        echo "❌ CONFIGURATION ERROR: Placeholder values detected in config.yaml"
        echo ""
        echo "🔧 PLEASE EDIT YOUR CONFIG FILE:"
        echo ""
        echo "1. Edit config/config.yaml with your actual credentials:"
        echo "   • abs_url: Your Audiobookshelf server URL"
        echo "   • abs_token: Get from Audiobookshelf Settings > Users > API Token"
        echo "   • hardcover_token: Get from https://hardcover.app/account/developer"
        echo "   • id: Choose a unique user identifier"
        echo ""
        echo "2. Save the file - the container will restart automatically"
        echo ""
        echo "📝 Example config.yaml:"
        echo "global:"
        echo "  min_progress_threshold: 5.0"
        echo "  # ... other settings ..."
        echo "users:"
        echo "  - id: alice"
        echo "    abs_url: https://audiobookshelf.mydomain.com"
        echo "    abs_token: your_actual_abs_token_here"
        echo "    hardcover_token: your_actual_hardcover_token_here"
        echo ""
        echo "💡 Use 'node src/main.js validate' to check your configuration"
        echo ""
        echo "🚫 Exiting until configuration is updated..."
        exit 1
    fi
    
    echo "✅ Configuration validation passed - no placeholder values found"
fi

# --- Permission Fix for Zero-Config Setup ---
# Only fix if not already owned by node (UID 1000)
if [ "$(stat -c %u /app/config)" != "1000" ]; then
    echo "Fixing config volume ownership..."
    chown -R node:node /app/config
fi
if [ "$(stat -c %u /app/data)" != "1000" ]; then
    echo "Fixing data volume ownership..."
    chown -R node:node /app/data
fi
# --- End Permission Fix ---

# Drop privileges to node user and execute the original command
exec su-exec node "$@" 