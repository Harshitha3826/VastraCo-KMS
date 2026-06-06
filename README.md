# VastraCo – Secure AWS-Powered Fashion E-Commerce Platform

A full-stack microservices-based fashion e-commerce application built using Node.js, PostgreSQL, Docker, and AWS. The platform demonstrates secure cloud-native application deployment using AWS KMS, AWS Secrets Manager, IAM Roles, and Amazon S3.

---

# Architecture

```text
┌──────────────┐
│              │
│    Users     │
│              │
└──────┬───────┘
       │
       ▼

┌──────────────────────────────┐
│       VastraCo Frontend      │
│       (React + Vite)         │
└──────────────┬───────────────┘
               │
               ▼

┌──────────────────────────────────────────┐
│            Docker Environment            │
│                                          │
│  ┌────────────┐                          │
│  │User Service│                          │
│  │ Port 3001  │                          │
│  └─────┬──────┘                          │
│        │                                 │
│  ┌─────▼──────┐                          │
│  │Product Svc │                          │
│  │ Port 3002  │                          │
│  └─────┬──────┘                          │
│        │                                 │
│  ┌─────▼──────┐                          │
│  │Order Svc   │                          │
│  │ Port 3003  │                          │
│  └────────────┘                          │
└───────────┬──────────────────────────────┘
            │
            ▼

┌──────────────────────────────────────────┐
│               AWS Services               │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │      AWS Secrets Manager           │  │
│  │  JWT & Database Credentials        │  │
│  └───────────────┬────────────────────┘  │
│                  │                       │
│                  ▼                       │
│  ┌────────────────────────────────────┐  │
│  │            AWS KMS                 │  │
│  │     Customer Managed Key           │  │
│  │      (Encryption Layer)            │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │             Amazon S3              │  │
│  │        Product Image Storage       │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘

               │
               ▼

┌──────────────────────────────┐
│     PostgreSQL Databases     │
│                              │
│   users_db                   │
│   products_db                │
│   orders_db                  │
└──────────────────────────────┘
```

Flow:

Users → Frontend → Microservices → PostgreSQL

Microservices → Secrets Manager → AWS KMS

Frontend → Product Service → S3 Images

---

# AWS Services Used

| Service             | Purpose                           |
| ------------------- | --------------------------------- |
| EC2                 | Hosts VastraCo Application        |
| Docker              | Containerized Deployment          |
| PostgreSQL          | User, Product and Order Databases |
| IAM Role            | Secure AWS Authentication         |
| AWS Secrets Manager | Secure Credential Storage         |
| AWS KMS             | Secret Encryption                 |
| Amazon S3           | Product Image Storage             |

---

# Project Structure

```text
VastraCo/

├── docker-compose.yml

├── frontend/
│   ├── src/
│   ├── public/
│   └── Dockerfile

├── user-service/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── models/
│   │   └── db/
│   └── Dockerfile

├── product-service/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── models/
│   │   └── db/
│   └── Dockerfile

├── order-service/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── models/
│   │   └── db/
│   └── Dockerfile

└── README.md
```

---

# Features

### User Service

* User Registration
* Login Authentication
* JWT Token Generation
* Profile Management

### Product Service

* Product Catalog
* Categories
* Product Variants
* Product Images from Amazon S3

### Order Service

* Order Placement
* Order Tracking
* Order History

---

# AWS KMS Implementation

KMS Key:

```text
vastraco-kms-key
```

Purpose:

* Encrypt Secrets Manager secrets
* Secure sensitive application credentials
* Centralized key management

---

# AWS Secrets Manager

Secret Name:

```text
vastraco/application
```

Stored Secrets:

```json
{
  "jwt_secret": "********",
  "user_db_password": "********",
  "product_db_password": "********",
  "order_db_password": "********"
}
```

Purpose:

* Remove hardcoded credentials
* Improve application security
* Centralized secret management

---

# IAM Role Configuration

Role Name:

```text
VastraCo-SecretsManager-Role
```

Attached Policies:

```text
SecretsManagerReadWrite
AWSKeyManagementServicePowerUser
```

Purpose:

* Allow EC2 to access Secrets Manager
* Allow EC2 to access KMS
* No Access Keys stored on server

---

# Amazon S3 Integration

Bucket Name:

```text
vastraco-product-images
```

Stored Assets:

```text
shirt1.jpg
shirt2.jpg
dress1.png
dress2.png
watch.png
```

Purpose:

* Product image hosting
* Scalable storage
* High availability

---

# EC2 Setup

Launch EC2:

```text
Ubuntu 24.04 LTS
t2.micro
```

Install AWS CLI:

```bash
sudo apt update

sudo apt install unzip curl -y

curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"

unzip awscliv2.zip

sudo ./aws/install

aws --version
```

Verify IAM Role:

```bash
aws sts get-caller-identity
```

Verify Secret Access:

```bash
aws secretsmanager get-secret-value \
--secret-id vastraco/application \
--region us-east-1
```

---

# Docker Deployment

Clone Repository

```bash
git clone https://github.com/Harshitha3826/VastraCo-KMS.git

cd VastraCo-KMS
```

Build Containers

```bash
docker compose up -d --build
```

Verify Containers

```bash
docker ps
```

---

# S3 Integration

Upload Images

```text
shirt1.jpg
shirt2.jpg
dress1.png
dress2.png
watch.png
```

Replace Product URLs:

```javascript
https://images.unsplash.com/...
```

with

```javascript
https://vastraco-product-images.s3.amazonaws.com/shirt1.jpg
```

Rebuild:

```bash
docker compose down

docker compose up -d --build
```

---



# Security Benefits

* Secrets encrypted using AWS KMS
* Credentials stored in AWS Secrets Manager
* IAM Role-based authentication
* No hardcoded AWS credentials
* Product assets stored securely in Amazon S3

---

