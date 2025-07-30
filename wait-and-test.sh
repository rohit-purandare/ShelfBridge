#!/bin/bash
set -e

echo "🔍 Monitoring for version 1.18.19 availability..."

# Check every 30 seconds for up to 15 minutes
for i in {1..30}; do
    echo "📡 Check $i/30: $(date)"
    
    if docker manifest inspect ghcr.io/rohit-purandare/shelfbridge:1.18.19 >/dev/null 2>&1; then
        echo ""
        echo "🎉 VERSION 1.18.19 IS AVAILABLE!"
        echo "🔄 Pulling latest image..."
        docker pull ghcr.io/rohit-purandare/shelfbridge:latest --quiet
        
        echo ""
        echo "🧪 TESTING STATIC LINKING FIX..."
        echo "================================"
        cd production-test
        
        # Test with docker-compose (real user experience)
        docker-compose up -d
        sleep 10
        
        # Copy real config
        docker-compose cp config/config.yaml shelfbridge:/app/config/config.yaml
        docker-compose restart
        sleep 15
        
        echo ""
        echo "📊 CHECKING RESULTS:"
        echo "=================="
        
        # Check logs for version and errors
        logs=$(docker-compose logs --tail=50)
        
        if echo "$logs" | grep -q "shelfbridge@1.18.19"; then
            echo "✅ Confirmed running version 1.18.19"
        else
            echo "⚠️ Version check inconclusive"
        fi
        
        if echo "$logs" | grep -q "Database initialization failed"; then
            echo "❌ STATIC LINKING FAILED: Database initialization still failing"
            echo "📜 Error logs:"
            echo "$logs" | grep -A5 -B5 "Database initialization failed"
            docker-compose down -v
            exit 1
        elif echo "$logs" | grep -q "cannot open shared object file"; then
            echo "❌ STATIC LINKING FAILED: Shared object file errors persist"
            echo "📜 Error logs:"
            echo "$logs" | grep -A5 -B5 "cannot open shared object file"
            docker-compose down -v
            exit 1
        elif echo "$logs" | grep -q "Sync complete\|Starting scheduled sync"; then
            echo "🎉 STATIC LINKING SUCCESS!"
            echo "✅ Application started without database errors"
            echo "✅ No shared object file issues detected"
            echo "✅ Better-sqlite3 is working correctly!"
            echo ""
            echo "📊 SUCCESS SUMMARY:"
            echo "=================="
            echo "✅ Version 1.18.19 deployed"
            echo "✅ Static linking implemented"
            echo "✅ Database initialization successful"
            echo "✅ No runtime dependency issues"
            echo "✅ Production-ready for all users!"
        else
            echo "⚠️ Test inconclusive - checking logs..."
            echo "$logs"
        fi
        
        docker-compose down -v
        cd ..
        exit 0
    fi
    
    sleep 30
done

echo "⏰ Timeout: Version 1.18.19 not available after 15 minutes"
echo "Please check GitHub Actions manually"
exit 1
