#!/bin/sh
set -e

# Default to node user, which is 1000:1000
export PUID=${PUID:-1000}
export PGID=${PGID:-1000}

# Function to check if all native modules are working
check_native_modules() {
    echo "🔍 Checking native modules..."

    # Check for any native modules in node_modules
    if find /app/node_modules -name "*.node" -type f 2>/dev/null | grep -q .; then
        echo "🔍 Found native modules, testing compatibility..."

        # Test specific native modules that we actually use
        modules_to_test="better-sqlite3"
        working_modules=0

        for module in $modules_to_test; do
            echo "   Testing $module..."

            # Capture detailed error information
            error_output=$(node -e "
                try {
                    const mod = require('$module');
                    console.log('✅ $module: OK');
                } catch(e) {
                    console.error('❌ $module: FAILED');
                    console.error('Error:', e.message);
                    if (e.message.includes('fcntl64')) {
                        console.error('💡 This is a glibc/musl compatibility issue');
                        console.error('💡 Try rebuilding with: npm rebuild $module --verbose');
                    } else if (e.message.includes('NODE_MODULE_VERSION')) {
                        console.error('💡 Node.js version mismatch - rebuild required');
                    } else if (e.message.includes('cannot open shared object')) {
                        console.error('💡 Missing system dependencies');
                    }
                    process.exit(1);
                }" 2>&1)

            if echo "$error_output" | grep -q "✅"; then
                working_modules=$((working_modules + 1))
                echo "   ✅ $module: Compatible"
            else
                echo "❌ Native module compatibility issue detected: $module failed to load"
                echo "$error_output"
                echo "🔍 Debug info:"
                echo "   Node version: $(node --version)"
                echo "   Platform: $(uname -s -m)"
                echo "   Libc: $(ldd --version 2>&1 | head -n1 || echo 'Unknown')"
                echo "   Module path: $(find /app/node_modules -name "$module" -type d | head -1)"
                echo "   Binary files: $(find /app/node_modules/$module -name "*.node" 2>/dev/null || echo 'None found')"
                return 1
            fi
        done

        echo "✅ All required native modules ($working_modules) are working correctly"
    else
        echo "ℹ️  No native modules found"
    fi

    return 0
}

# Function to ensure directories exist and have the correct permissions
create_and_verify_permissions() {
    mkdir -p $1

    # Only try to set permissions if the current user is root
    # If the container is run as an unpriveleged user, it means a custom user has been provided to docker and the owner is
    # responsible for making sure file ownership is correct. Running chown in that case (as non-root) will cause an error
    if [ "$(id -u)" == "0" ]; then
        if [ "$(stat -c %u $1)" != "${PUID}" ]; then
            echo "Fixing $1 ownership..."
            chown -R ${PUID}:${PGID} $1
        fi
    else
        if [ "$(stat -c %u $1)" != "$(id -u)" ]; then
            echo "You have specified a custom user via docker. Make sure that $1 is owned by that user."
            exit 1
        fi
    fi
}

# Check native modules on startup - should never fail with proper Docker build
if ! check_native_modules; then
    echo ""
    echo "🚨 CRITICAL ERROR: Native modules not working"
    echo ""
    echo "This should not happen with the current Docker build process."
    echo "The image may be corrupted or from an old version."
    echo ""
    echo "🔧 IMMEDIATE ACTION REQUIRED:"
    echo "  1. Pull the latest image: docker pull ghcr.io/rohit-purandare/shelfbridge:latest"
    echo "  2. Or rebuild completely: docker-compose build --no-cache"
    echo ""
    echo "🐛 If this error persists, please report it:"
    echo "   https://github.com/rohit-purandare/shelfbridge/issues/new"
    echo ""
    echo "📖 Documentation: https://github.com/rohit-purandare/shelfbridge/wiki"
    echo ""
    exit 1
fi

# Always ensure directories exist (both container and host-side for bind mounts)
create_and_verify_permissions /app/config
create_and_verify_permissions /app/data
create_and_verify_permissions /app/logs

# Fix permissions on any existing log files from previous runs
if [ -d "/app/logs" ]; then
    # Only fix permissions if running as root (can change ownership)
    if [ "$(id -u)" == "0" ]; then
        find /app/logs -name "shelfbridge-*.log" -type f -exec chown ${PUID}:${PGID} {} \; -exec chmod 644 {} \; 2>/dev/null || true
        echo "Fixed permissions for existing log files (if any)"
    else
        # If running as non-root, just try to make files writable by owner
        find /app/logs -name "shelfbridge-*.log" -type f -exec chmod u+w {} \; 2>/dev/null || true
    fi
fi

# For bind mounts, ensure host directories are created by writing to them
# This forces Docker to create the directories on the host side even if container exits early
touch /app/config/.docker-init 2>/dev/null || true
touch /app/data/.docker-init 2>/dev/null || true
touch /app/logs/.docker-init 2>/dev/null || true

# Clean up the temp files (they've served their purpose)
rm -f /app/config/.docker-init /app/data/.docker-init /app/logs/.docker-init 2>/dev/null || true

# Copy sample config if it doesn't exist (handles both mounted and non-mounted scenarios)
if [ ! -f "/app/config/config.yaml.example" ]; then
    echo "📋 Copying sample config to config directory..."
    cp /app/.config-template/config.yaml.example /app/config/config.yaml.example
    echo "✅ Sample config available at ./config/config.yaml.example"
fi

# Show configuration guidance without auto-creating config.yaml
echo ""
echo "🚀 SHELFBRIDGE CONFIGURATION OPTIONS:"
echo ""

if [ -f "/app/config/config.yaml" ]; then
    echo "📁 Using YAML configuration file: /app/config/config.yaml"
    echo "   • YAML configuration takes highest priority"
    echo "   • Environment variables will only fill missing values"
elif [ -n "$SHELFBRIDGE_USER_0_ID" ]; then
    echo "🔧 Using environment variables for configuration"
    echo "   • No config.yaml file found - using SHELFBRIDGE_* environment variables"
    echo "   • This is perfect for container deployments!"
else
    echo "⚠️  No configuration detected!"
    echo ""
    echo "📝 OPTION 1: Create YAML configuration file"
    echo "   • Copy: cp /app/config/config.yaml.example /app/config/config.yaml"
    echo "   • Edit: /app/config/config.yaml with your API credentials"
    echo ""
    echo "🔧 OPTION 2: Use environment variables (recommended for Docker)"
    echo "   • Set SHELFBRIDGE_USER_0_ID, SHELFBRIDGE_USER_0_ABS_URL, etc."
    echo "   • No config file needed - perfect for containers!"
    echo ""
    echo "📖 Documentation: https://github.com/rohit-purandare/shelfbridge/wiki"
    echo "🐛 Need help? https://github.com/rohit-purandare/shelfbridge/issues"
fi
echo ""

# Check if config.yaml still contains placeholder values
if [ -f "/app/config/config.yaml" ]; then
    echo "🔍 Checking configuration for placeholder values..."

    # Parse YAML and inspect only configured user fields, ignoring comments.
    placeholder_status=0
    node /app/scripts/check-config-placeholders.js /app/config/config.yaml || placeholder_status=$?

    if [ "$placeholder_status" -eq 1 ]; then
        echo ""
        echo "❌ CONFIGURATION ERROR: Placeholder values detected in config.yaml"
        echo ""
        echo "🔧 CHOOSE YOUR CONFIGURATION METHOD:"
        echo ""
        echo "📝 OPTION 1: Edit the existing config.yaml file"
        echo "   • Replace placeholder values with your actual credentials:"
        echo "     - abs_url: Your Audiobookshelf server URL"
        echo "     - abs_token: Get from Audiobookshelf Settings > Users > API Token"
        echo "     - hardcover_token: Get from https://hardcover.app/account/developer"
        echo "     - id: Choose a unique user identifier"
        echo "   • Save the file - container will restart automatically"
        echo ""
        echo "🔧 OPTION 2: Switch to environment variables (easier for Docker)"
        echo "   • Delete config.yaml: rm /app/config/config.yaml"
        echo "   • Set environment variables: SHELFBRIDGE_USER_0_ID, SHELFBRIDGE_USER_0_ABS_URL, etc."
        echo "   • Restart container"
        echo ""
        echo "💡 Use 'node src/main.js validate' to check your configuration"
        echo ""
        echo "📖 Setup Guide: https://github.com/rohit-purandare/shelfbridge/wiki"
        echo "🐛 Need help? https://github.com/rohit-purandare/shelfbridge/issues"
        echo ""
        echo "🚫 Exiting until configuration is updated..."
        exit 0
    elif [ "$placeholder_status" -gt 1 ]; then
        echo "⚠️  Placeholder pre-check could not parse config.yaml; application validation will report details"
    else
        echo "✅ Configuration validation passed - no placeholder values found"
    fi
fi

# Drop privileges when running as root, otherwise run as current user in order to support a custom specified docker user
if [ "$(id -u)" == "0" ]; then
    exec su-exec ${PUID}:${PGID} "$@"
else
    exec "$@"
fi
