# Manual EC2 Deployment (Without Docker)

If you prefer traditional installation without Docker:

## Prerequisites
- AWS EC2 instance (Amazon Linux 2 or Ubuntu)
- AWS RDS PostgreSQL (already configured)
- AWS S3 bucket (already configured)

## Step-by-Step Installation

### 1. Connect to EC2
```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
```

### 2. Install Node.js
```bash
# For Amazon Linux 2:
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# For Ubuntu:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Install Redis
```bash
# For Amazon Linux 2:
sudo amazon-linux-extras install redis6 -y
sudo systemctl start redis
sudo systemctl enable redis  # Auto-start on boot

# For Ubuntu:
sudo apt install redis-server -y
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test Redis
redis-cli ping
# Should return: PONG
```

### 4. Clone Your Project
```bash
cd ~
git clone https://github.com/your-username/copy-backend.git
cd copy-backend
```

### 5. Create .env File
```bash
nano .env
```

Paste this (update with your values):
```env
# Database Configuration
DB_HOST=copywright.c5e0waue8dzf.ap-south-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=copywright123456

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Server Configuration
PORT=4000
CORS_ORIGINS=https://your-frontend-domain.com,http://your-ec2-ip:3000

# AWS S3 Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
S3_BUCKET_NAME=your-s3-bucket-name

# JWT Secret (generate with: openssl rand -hex 64)
JWT_SECRET=your-long-random-jwt-secret-key-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Save: `Ctrl+X`, then `Y`, then `Enter`

### 6. Install Dependencies
```bash
npm install
```

### 7. Test Run (Temporary)
```bash
node index.js
```

You should see:
```
Server is running on port 4000
Socket Manager Initialized
Worker listening for messages...
```

Press `Ctrl+C` to stop.

### 8. Set Up PM2 (Process Manager)

PM2 keeps your app running even after you disconnect from SSH:

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start your app with PM2
pm2 start index.js --name "copywright-backend"

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Copy and run the command it outputs

# Check status
pm2 status

# View logs
pm2 logs copywright-backend
```

### 9. Configure EC2 Security Group

In AWS Console, add these inbound rules:
- **Port 4000** (TCP) - For your backend API
- **Port 22** (TCP) - For SSH access

### 10. Test Your Deployment

From your local machine:
```bash
# Test API
curl http://your-ec2-ip:4000/

# Should return: "Welcome to the Copy Backend Server"
```

## Managing Your Application

### View Logs
```bash
pm2 logs copywright-backend

# Or just errors
pm2 logs copywright-backend --err

# Clear logs
pm2 flush
```

### Restart Application
```bash
pm2 restart copywright-backend
```

### Stop Application
```bash
pm2 stop copywright-backend
```

### Update Code
```bash
cd ~/copy-backend
git pull origin main
npm install  # If package.json changed
pm2 restart copywright-backend
```

### Check if Services are Running
```bash
# Check Node.js app
pm2 status

# Check Redis
sudo systemctl status redis
redis-cli ping

# Check if port 4000 is listening
sudo netstat -tulpn | grep 4000
```

## Troubleshooting

### App won't start
```bash
# Check logs
pm2 logs copywright-backend

# Check if port is already in use
sudo lsof -i :4000

# Kill process on port
sudo kill -9 <PID>
```

### Redis connection failed
```bash
# Check if Redis is running
sudo systemctl status redis

# Start Redis
sudo systemctl start redis

# Test connection
redis-cli ping
```

### Can't connect to RDS
```bash
# Test database connection
npm install -g pg

psql -h copywright.c5e0waue8dzf.ap-south-1.rds.amazonaws.com \
     -U postgres \
     -d postgres
# Enter password: copywright123456
```

Make sure your EC2 security group is allowed in RDS security group.

## Useful PM2 Commands

```bash
pm2 list                    # List all apps
pm2 info copywright-backend # Detailed info
pm2 monit                   # Monitor CPU/Memory
pm2 restart all             # Restart all apps
pm2 delete copywright-backend # Remove from PM2
pm2 logs --lines 100        # Last 100 log lines
```

## Setting Up HTTPS (Optional)

### Install Nginx
```bash
sudo yum install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Configure Nginx
```bash
sudo nano /etc/nginx/conf.d/copywright.conf
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Install SSL Certificate (Let's Encrypt)
```bash
sudo yum install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## Comparison: Manual vs Docker

| Feature | Manual Installation | Docker Compose |
|---------|---------------------|----------------|
| Initial Setup | More steps | Fewer steps |
| Control | Direct control | Abstracted |
| Updates | `git pull && pm2 restart` | `git pull && docker-compose up -d` |
| Isolation | Shared system | Isolated containers |
| Portability | Server-specific | Works anywhere |
| Learning Curve | Familiar | Need to learn Docker |

Choose what works best for you!
