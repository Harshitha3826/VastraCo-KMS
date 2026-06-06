```bash
#!/bin/bash

# ==========================================================
# VastraCo EC2 Bootstrap Script
# Ubuntu 24.04 LTS
# ==========================================================

set -euxo pipefail

# Log everything
exec > >(tee /var/log/vastraco-setup.log)
exec 2>&1

echo "======================================"
echo "Starting VastraCo Deployment"
echo "Time: $(date)"
echo "======================================"

# ----------------------------------------------------------
# Step 1 - Update System
# ----------------------------------------------------------

apt-get update -y
apt-get upgrade -y

# ----------------------------------------------------------
# Step 2 - Install Dependencies
# ----------------------------------------------------------

apt-get install -y \
    docker.io \
    git \
    curl \
    unzip

# ----------------------------------------------------------
# Step 3 - Enable Docker
# ----------------------------------------------------------

systemctl enable docker
systemctl start docker

usermod -aG docker ubuntu

# ----------------------------------------------------------
# Step 4 - Install Docker Compose Plugin
# ----------------------------------------------------------

mkdir -p /usr/local/lib/docker/cli-plugins

curl -SL \
https://github.com/docker/compose/releases/download/v2.39.1/docker-compose-linux-x86_64 \
-o /usr/local/lib/docker/cli-plugins/docker-compose

chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

docker compose version || true

# ----------------------------------------------------------
# Step 5 - Install AWS CLI
# ----------------------------------------------------------

curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" \
-o "awscliv2.zip"

unzip -o awscliv2.zip

./aws/install

aws --version

# ----------------------------------------------------------
# Step 6 - Clone Repository
# ----------------------------------------------------------

cd /home/ubuntu

git clone https://github.com/Harshitha3826/VastraCo-KMS.git

chown -R ubuntu:ubuntu /home/ubuntu/VastraCo-KMS

# ----------------------------------------------------------
# Step 7 - Deploy Application
# ----------------------------------------------------------

cd /home/ubuntu/VastraCo-KMS

docker compose pull || true

docker compose up -d --build

# ----------------------------------------------------------
# Step 8 - Wait For Containers
# ----------------------------------------------------------

sleep 30

docker ps

# ----------------------------------------------------------
# Step 9 - Verify IAM Role
# ----------------------------------------------------------

echo "===== IAM ROLE CHECK ====="

aws sts get-caller-identity || true

# ----------------------------------------------------------
# Step 10 - Verify Secrets Manager
# ----------------------------------------------------------

echo "===== SECRET CHECK ====="

aws secretsmanager get-secret-value \
--secret-id vastraco/application \
--region us-east-1 || true

# ----------------------------------------------------------
# Step 11 - Verify S3 Bucket
# ----------------------------------------------------------

echo "===== S3 CHECK ====="

aws s3 ls s3://vastraco-product-images || true

# ----------------------------------------------------------
# Step 12 - Deployment Summary
# ----------------------------------------------------------

PUBLIC_IP=$(curl -s \
http://169.254.169.254/latest/meta-data/public-ipv4)

echo ""
echo "======================================"
echo "VastraCo Deployment Complete"
echo "======================================"
echo "Public IP: $PUBLIC_IP"
echo "Frontend URL: http://$PUBLIC_IP"
echo ""
echo "Useful Commands:"
echo "docker ps"
echo "docker logs <container>"
echo "docker compose restart"
echo "cat /var/log/vastraco-setup.log"
echo "======================================"
```
