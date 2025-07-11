#!/bin/sh
set -e

# Copy sample config to mounted volume if it doesn't exist
if [ ! -f "/app/config/config.yaml.example" ]; then
    echo "📋 Copying sample config to mounted volume..."
    cp /app/.config-template/config.yaml.example /app/config/config.yaml.example
    echo "✅ Sample config available at ./config/config.yaml.example"
    echo "💡 Copy it to config.yaml and edit with your credentials"
fi

# Execute the original command
exec "$@" 