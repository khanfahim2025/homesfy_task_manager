#!/usr/bin/env bash
# Create a t3.micro EC2 in ap-south-1 (personal AWS account) and deploy task manager.
# Requires AWS credentials with ec2:RunInstances in server/.env or environment.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="${AWS_REGION:-ap-south-1}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.micro}"
KEY_NAME="${EC2_KEY_NAME:-homesfy-task-manager}"
KEY_FILE="${EC2_KEY_FILE:-$HOME/Downloads/homesfy-tasks-key.pem}"
APP_DIR="/var/app/taskmanager"

# Load AWS creds from server/.env if not already set
if [[ -z "${AWS_ACCESS_KEY_ID:-}" && -f "$ROOT/server/.env" ]]; then
  AWS_ACCESS_KEY_ID=$(grep '^AWS_ACCESS_KEY_ID=' "$ROOT/server/.env" | cut -d= -f2-)
  AWS_SECRET_ACCESS_KEY=$(grep '^AWS_SECRET_ACCESS_KEY=' "$ROOT/server/.env" | cut -d= -f2-)
  AWS_REGION=$(grep '^AWS_REGION=' "$ROOT/server/.env" | cut -d= -f2-)
  export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION
fi

: "${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID in server/.env or environment}"
: "${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY in server/.env or environment}"

export AWS_DEFAULT_REGION="$REGION"

DB_PASS=$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 20)

echo "==> AWS account:"
aws sts get-caller-identity

echo "==> Resolving Ubuntu 22.04 AMI..."
AMI=$(aws ec2 describe-images \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" "Name=state,Values=available" \
  --query 'sort_by(Images,&CreationDate)[-1].ImageId' --output text)
echo "AMI: $AMI"

echo "==> Ensuring key pair $KEY_NAME exists..."
PUB="$HOME/.ssh/homesfy-task-manager.pub"
if [[ ! -f "$PUB" ]]; then
  ssh-keygen -t ed25519 -f "$HOME/.ssh/homesfy-task-manager" -N "" -C "homesfy-task-manager"
  PUB="$HOME/.ssh/homesfy-task-manager.pub"
fi

aws ec2 import-key-pair --key-name "$KEY_NAME" \
  --public-key-material "fileb://$PUB" 2>/dev/null \
  || aws ec2 describe-key-pairs --key-names "$KEY_NAME" >/dev/null

echo "==> Creating security group..."
VPC=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
SG_NAME="homesfy-task-manager-sg"
SG_ID=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$SG_NAME" "Name=vpc-id,Values=$VPC" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo None)

if [[ "$SG_ID" == "None" || -z "$SG_ID" ]]; then
  SG_ID=$(aws ec2 create-security-group --group-name "$SG_NAME" \
    --description "Homesfy task manager" --vpc-id "$VPC" --query GroupId --output text)
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 22 --cidr 0.0.0.0/0
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0
fi
echo "Security group: $SG_ID"

echo "==> Launching $INSTANCE_TYPE instance..."
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$AMI" \
  --instance-type "$INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=homesfy-task-manager}]' \
  --query 'Instances[0].InstanceId' --output text)
echo "Instance: $INSTANCE_ID"

echo "==> Waiting for instance to run..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
echo "Public IP: $PUBLIC_IP"

echo "==> Waiting for SSH (up to 3 min)..."
SSH_KEY="${EC2_SSH_KEY:-$HOME/.ssh/homesfy-task-manager}"
for i in $(seq 1 36); do
  if ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no "ubuntu@$PUBLIC_IP" "echo ready" 2>/dev/null; then
    break
  fi
  sleep 5
done

echo "==> Running server setup..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ubuntu@$PUBLIC_IP" "DB_PASS='$DB_PASS' bash -s" <<REMOTE
set -euo pipefail
sudo mkdir -p $APP_DIR
sudo chown ubuntu:ubuntu $APP_DIR
git clone https://github.com/khanfahim2025/homesfy_task_manager.git $APP_DIR 2>/dev/null || true
cd $APP_DIR && git pull
bash deploy/setup-server.sh
REMOTE

echo "==> Uploading production .env..."
SESSION_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ubuntu@$PUBLIC_IP" "cat > $APP_DIR/server/.env" <<ENV
NODE_ENV=production
PORT=3001
APP_URL=http://${PUBLIC_IP}
API_URL=http://${PUBLIC_IP}
DATABASE_URL=postgresql://taskmanager:${DB_PASS}@127.0.0.1:5432/taskmanager
SESSION_SECRET=${SESSION_SECRET}
ALLOW_SIGNUP=false
ALLOWED_EMAIL_DOMAIN=homesfy.in
BOOTSTRAP_ADMIN_EMAIL=fahim.khan@homesfy.in
BOOTSTRAP_ADMIN_PASSWORD=HomesfyTask2026!
BOOTSTRAP_MEMBER_PASSWORD=member12345
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
S3_BUCKET=homesfy-task-manager
MAX_UPLOAD_BYTES=104857600
UPLOAD_DIR=${APP_DIR}/uploads
TZ=Asia/Kolkata
ENV

echo "==> Deploying app..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ubuntu@$PUBLIC_IP" "cd $APP_DIR && bash deploy/deploy-app.sh"

echo ""
echo "============================================"
echo "DEPLOYED: http://${PUBLIC_IP}"
echo "Health:   http://${PUBLIC_IP}/api/health"
echo "Login:    fahim.khan@homesfy.in / HomesfyTask2026!"
echo "Instance: $INSTANCE_ID"
echo "SSH:      ssh -i $SSH_KEY ubuntu@$PUBLIC_IP"
echo "============================================"

# Save instance id for teardown
echo "$INSTANCE_ID" > "$ROOT/deploy/.last-instance-id"
echo "$PUBLIC_IP" > "$ROOT/deploy/.last-instance-ip"
