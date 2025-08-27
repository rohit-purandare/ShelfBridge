# 🔧 Prerequisites

Before you can use ShelfBridge, you'll need to set up accounts and obtain API tokens for both Audiobookshelf and Hardcover. This guide walks you through everything you need.

## 📋 System Requirements

### Minimum Requirements

- **Operating System**: Linux, macOS, or Windows
- **Memory**: 512MB RAM minimum (1GB recommended)
- **Storage**: 100MB free space
- **Network**: Internet connection to reach your Audiobookshelf server and Hardcover

### Software Requirements

Choose one of these options:

**Option 1: Docker (Recommended)**

- Docker 20.10.0 or higher
- Docker Compose 1.28.0 or higher

**Option 2: Node.js**

- Node.js 18.0.0 or higher
- npm (included with Node.js)

### Check Your Versions

```bash
# Check Docker version
docker --version
docker-compose --version

# Check Node.js version
node --version
npm --version
```

## 🔊 Audiobookshelf Setup

### Account Requirements

You need one of the following:

- **Admin account** on your Audiobookshelf server
- **User account** with library access permissions

### Audiobookshelf API Token

#### Step 1: Access Your Audiobookshelf Server

1. Open your Audiobookshelf server in a web browser
2. Log in with your account credentials

#### Step 2: Navigate to User Settings

1. Click your **user avatar** in the top-right corner
2. Select **"Settings"** from the dropdown menu
3. Go to the **"Users"** section in the left sidebar
4. Click on **your username** in the user list

#### Step 3: Generate API Token

1. Scroll down to the **"API Token"** section
2. Click **"Generate Token"** or **"Generate New Token"**
3. **Copy the token immediately** - you won't be able to see it again
4. Save it securely (you'll need it for ShelfBridge configuration)

#### Step 4: Verify Library Access

Make sure your user account has access to the libraries containing your audiobooks:

1. Go to **"Libraries"** in the left sidebar
2. Verify you can see your audiobook libraries
3. If not, ask your admin to grant access

### Testing Your Token

```bash
# Replace YOUR_SERVER_URL and YOUR_TOKEN with actual values
curl -H "Authorization: Bearer YOUR_TOKEN" "YOUR_SERVER_URL/api/me"
```

If successful, you'll see your user information in JSON format.

**Important**: When adding your token to ShelfBridge configuration, use only the raw token value (without "Bearer " prefix). ShelfBridge will automatically add the "Bearer " prefix when making API requests.

## 📚 Hardcover Setup

### Account Requirements

- **Free Hardcover account** at [hardcover.app](https://hardcover.app)
- **API access enabled** in your account settings

### Step 1: Create Hardcover Account

1. Go to [hardcover.app](https://hardcover.app)
2. Sign up for a free account
3. Verify your email address

### Step 2: Enable API Access

1. Log in to your Hardcover account
2. Go to **Account Settings** (click your avatar → Settings)
3. Look for **"Developer"** or **"API"** section
4. **Enable API access** for your account

### Step 3: Get Hardcover API Token

1. Visit [hardcover.app/account/developer](https://hardcover.app/account/developer)
2. If you don't see this page, ensure API access is enabled (Step 2)
3. **Generate a new API token**
4. **Copy the token immediately** - you won't be able to see it again
5. Save it securely (you'll need it for ShelfBridge configuration)

### Testing Your Token

```bash
# Replace YOUR_HARDCOVER_TOKEN with your actual token
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_HARDCOVER_TOKEN" \
  -d '{"query": "{ me { id name } }"}' \
  https://api.hardcover.app/v1/graphql
```

If successful, you'll see your Hardcover user information.

**Important**: When adding your token to ShelfBridge configuration, use only the raw token value (without "Bearer " prefix). ShelfBridge will automatically add the "Bearer " prefix when making API requests.

## 🌐 Network Requirements

### Firewall and Network Access

ShelfBridge needs to connect to:

- **Your Audiobookshelf server** (usually local network or VPN)
- **Hardcover API** (`api.hardcover.app` on port 443/HTTPS)

### Common Network Issues

- **Audiobookshelf behind reverse proxy**: Make sure the API endpoints are accessible
- **Corporate firewalls**: May need to whitelist `api.hardcover.app`
- **VPN requirements**: If Audiobookshelf is on a private network

## 📖 Understanding Your Library

### Audiobookshelf Library Requirements

For ShelfBridge to work effectively:

- **Books should have metadata** with ISBN or ASIN when possible
- **Reading progress** should be tracked in Audiobookshelf
- **Book formats** supported: any format that Audiobookshelf can track

### Book Identifier Priority

ShelfBridge matches books in this order:

1. **ASIN** (Amazon Standard Identification Number) - preferred for audiobooks
2. **ISBN** (International Standard Book Number) - fallback for all book types
3. **No identifier** - books will be skipped

### Improving Match Success

To improve book matching:

- Ensure your audiobooks have **ASIN metadata** when possible
- Add **ISBN information** to your book metadata
- Use **consistent naming** between platforms

## ✅ Pre-Setup Checklist

Before proceeding with installation, verify you have:

- [ ] **Audiobookshelf server** running and accessible
- [ ] **Audiobookshelf API token** copied and saved securely
- [ ] **Hardcover account** created and verified
- [ ] **Hardcover API access** enabled in account settings
- [ ] **Hardcover API token** copied and saved securely
- [ ] **Docker** or **Node.js 18+** installed on your system
- [ ] **Network access** to both services confirmed
- [ ] **Books with progress** in your Audiobookshelf library

## 🔗 External Resources

### API Documentation

- [Audiobookshelf API Docs](https://api.audiobookshelf.org/) - Official API reference
- [Hardcover Developer Portal](https://hardcover.app/account/developer) - Get your API token here

### Installation Software

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) - For Windows/Mac users
- [Docker Engine](https://docs.docker.com/engine/install/) - For Linux users
- [Node.js Downloads](https://nodejs.org/en/download/) - Official Node.js installer

## 🎯 What's Next?

Once you have all prerequisites ready:

1. **[Quick Start Guide](Quick-Start.md)** - Get running in 5 minutes
2. **[Docker Setup](Docker-Setup.md)** - Detailed Docker installation
3. **[Node.js Setup](Node-Setup.md)** - Detailed Node.js installation

## 🆘 Troubleshooting Prerequisites

### "Can't access Audiobookshelf admin settings"

- You need an admin account or library access permissions
- Contact your Audiobookshelf administrator

### "Hardcover API token page not found"

- Ensure API access is enabled in your account settings
- Try logging out and back in to Hardcover
- Contact Hardcover support if the option isn't available

### "Token authentication failed"

- Double-check you copied the complete token
- Tokens are case-sensitive and may contain special characters
- **Do not include "Bearer " prefix** - use only the raw token value
- If you accidentally included "Bearer ", ShelfBridge will automatically remove it and log a warning
- Generate a new token if you're unsure

---

**Ready to install?** Continue with the [Quick Start Guide](Quick-Start.md) or choose your preferred [installation method](Installation-Methods.md).
