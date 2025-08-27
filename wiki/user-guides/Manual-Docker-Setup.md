# 🐳 Manual Docker Setup

This guide covers advanced Docker configurations and manual setup options for ShelfBridge. Use this if you need custom Docker deployments beyond the standard Docker Compose setup.

## 🎯 When to Use Manual Docker Setup

**Use manual Docker commands when:**

- Custom container orchestration (Kubernetes, Docker Swarm)
- Specific networking requirements
- Integration with existing Docker stacks
- Advanced volume management
- Custom security configurations

**For most users:** Use [Docker Setup Guide](Docker-Setup.md) instead.

## 📋 Prerequisites

- Docker 20.10.0 or higher
- Basic Docker knowledge
- Understanding of volumes, networks, and containers
- Familiarity with command-line operations

## 🏗️ Manual Docker Run

### Basic Manual Setup

```bash
# Create named volumes
docker volume create shelfbridge-config
docker volume create shelfbridge-data

# Run container
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

### With Environment Variables

```bash
# Run with custom environment
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  -e NODE_ENV=production \
  -e SHELFBRIDGE_LOG_LEVEL=info \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

### With Custom User

```bash
# Run as specific user (security best practice)
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

### With Custom Network

```bash
# Create custom network
docker network create shelfbridge-network

# Run container on custom network
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  --network shelfbridge-network \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

## 📁 Volume Management

### Named Volumes (Recommended)

```bash
# Create volumes
docker volume create shelfbridge-config
docker volume create shelfbridge-data

# Inspect volumes
docker volume inspect shelfbridge-config
docker volume inspect shelfbridge-data

# List all volumes
docker volume ls | grep shelfbridge
```

### Bind Mounts

```bash
# Create local directories
mkdir -p /opt/shelfbridge/config
mkdir -p /opt/shelfbridge/data

# Set permissions
sudo chown -R 1000:1000 /opt/shelfbridge

# Run with bind mounts
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  -v /opt/shelfbridge/config:/app/config \
  -v /opt/shelfbridge/data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

### Volume Backup and Restore

```bash
# Backup volumes
docker run --rm \
  -v shelfbridge-config:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/shelfbridge-config.tar.gz -C /data .

docker run --rm \
  -v shelfbridge-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/shelfbridge-data.tar.gz -C /data .

# Restore volumes
docker run --rm \
  -v shelfbridge-config:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/shelfbridge-config.tar.gz"
```

## 🔧 Container Configuration

### Health Checks

```bash
# Run with custom health check
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  --health-cmd "node src/main.js validate --help" \
  --health-interval 30s \
  --health-timeout 10s \
  --health-retries 3 \
  --health-start-period 10s \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

### Resource Limits

```bash
# Run with memory and CPU limits
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  --memory 512m \
  --cpus 1.0 \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

### Logging Configuration

```bash
# Run with custom logging
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

## 🏢 Enterprise Configurations

### Docker Swarm Mode

```bash
# Create service
docker service create \
  --name shelfbridge \
  --replicas 1 \
  --restart-condition on-failure \
  --mount type=volume,source=shelfbridge-config,target=/app/config \
  --mount type=volume,source=shelfbridge-data,target=/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest

# Scale service (usually not needed for ShelfBridge)
docker service scale shelfbridge=1

# Update service
docker service update shelfbridge --image ghcr.io/rohit-purandare/shelfbridge:latest
```

### Kubernetes Deployment

**deployment.yaml:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shelfbridge
spec:
  replicas: 1
  selector:
    matchLabels:
      app: shelfbridge
  template:
    metadata:
      labels:
        app: shelfbridge
    spec:
      containers:
        - name: shelfbridge
          image: ghcr.io/rohit-purandare/shelfbridge:latest
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          volumeMounts:
            - name: config
              mountPath: /app/config
            - name: data
              mountPath: /app/data
      volumes:
        - name: config
          persistentVolumeClaim:
            claimName: shelfbridge-config
        - name: data
          persistentVolumeClaim:
            claimName: shelfbridge-data
```

**pvc.yaml:**

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shelfbridge-config
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shelfbridge-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
```

## 🔐 Security Configurations

### Run as Non-Root User

```bash
# Create user in container
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  --read-only \
  --tmpfs /tmp \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

### Security Options

```bash
# Run with additional security
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

## 🌐 Network Configurations

### Custom Bridge Network

```bash
# Create custom network
docker network create \
  --driver bridge \
  --subnet 172.20.0.0/16 \
  --gateway 172.20.0.1 \
  shelfbridge-network

# Run container on custom network
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  --network shelfbridge-network \
  --ip 172.20.0.10 \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

### Host Network (Advanced)

```bash
# Run with host networking (use cautiously)
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  --network host \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

## 🔄 Container Management

### Start/Stop/Restart

```bash
# Start container
docker start shelfbridge

# Stop container
docker stop shelfbridge

# Restart container
docker restart shelfbridge

# Force stop (if needed)
docker kill shelfbridge

# Remove container
docker rm shelfbridge
```

### Container Inspection

```bash
# View container details
docker inspect shelfbridge

# View container logs
docker logs shelfbridge

# Follow logs
docker logs -f shelfbridge

# Execute commands in container
docker exec -it shelfbridge bash
docker exec -it shelfbridge node src/main.js validate
```

### Resource Monitoring

```bash
# View resource usage
docker stats shelfbridge

# View container processes
docker top shelfbridge

# View port mappings
docker port shelfbridge
```

## 🛠️ Troubleshooting

### Container Won't Start

```bash
# Check container status
docker ps -a

# View container logs
docker logs shelfbridge

# Check image availability
docker images | grep shelfbridge

# Check volume mounts
docker inspect shelfbridge | grep -A 20 Mounts
```

### Permission Issues

```bash
# Check volume permissions
docker exec shelfbridge ls -la /app/config
docker exec shelfbridge ls -la /app/data

# Fix permissions
docker exec shelfbridge chown -R 1000:1000 /app/config
docker exec shelfbridge chown -R 1000:1000 /app/data
```

### Network Issues

```bash
# Check network connectivity
docker exec shelfbridge ping -c 4 google.com

# Check DNS resolution
docker exec shelfbridge nslookup api.hardcover.app

# Test API connectivity
docker exec shelfbridge node src/main.js validate --connections
```

## 📈 Performance Tuning

### For Large Libraries

```bash
# Increase memory allocation
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  --memory 1g \
  --memory-swap 2g \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

### For Slow Storage

```bash
# Use tmpfs for temporary files
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  --tmpfs /tmp:rw,size=100m \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

## 🔗 Integration Examples

### With Traefik (Reverse Proxy)

```bash
# Run with Traefik labels
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  --label "traefik.enable=false" \
  --network traefik \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

### With Watchtower (Auto-Updates)

```bash
# Run with Watchtower labels
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  --label "com.centurylinklabs.watchtower.enable=true" \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

## 🎯 Next Steps

1. **Configure ShelfBridge**: [Configuration Overview](../admin/Configuration-Reference.md)
2. **Run First Sync**: [First Sync Guide](First-Sync.md)
3. **Set Up Monitoring**: [Understanding Sync Results](Understanding-Sync-Results.md)

## 🆘 Need Help?

- **Docker Issues**: [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)
- **Configuration Help**: [Configuration Overview](../admin/Configuration-Reference.md)
- **General Questions**: [FAQ](../troubleshooting/FAQ.md)

---

**Advanced Docker setups give you complete control over your ShelfBridge deployment!** 🐳⚙️
