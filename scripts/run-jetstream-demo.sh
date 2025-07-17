#!/bin/bash

# JetStream Sequential Processing Demo Script
# This script sets up the environment and demonstrates the system

set -e

echo "🚀 JetStream Sequential Processing Demo"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose is required but not installed."
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    print_error "Node.js is required but not installed."
    exit 1
fi

# Function to cleanup
cleanup() {
    print_status "Cleaning up..."
    docker-compose -f docker-compose.jetstream.yml down
    print_success "Cleanup completed"
}

# Set trap for cleanup on exit
trap cleanup EXIT

# Step 1: Start infrastructure
print_status "Starting NATS JetStream and Redis..."
docker-compose -f docker-compose.jetstream.yml up -d

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 10

# Check NATS health
print_status "Checking NATS JetStream health..."
if docker-compose -f docker-compose.jetstream.yml exec -T nats nats server check --server nats://localhost:4222 &> /dev/null; then
    print_success "NATS JetStream is healthy"
else
    print_error "NATS JetStream is not healthy"
    exit 1
fi

# Check Redis health
print_status "Checking Redis health..."
if docker-compose -f docker-compose.jetstream.yml exec -T redis redis-cli ping | grep -q PONG; then
    print_success "Redis is healthy"
else
    print_error "Redis is not healthy"
    exit 1
fi

# Step 2: Install dependencies (if needed)
if [ ! -d "node_modules" ]; then
    print_status "Installing Node.js dependencies..."
    npm install --legacy-peer-deps
    print_success "Dependencies installed"
fi

# Step 3: Set environment variables
export NATS_URL="nats://localhost:4222"
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
export INSTANCE_ID="demo-instance-$(date +%s)"

print_status "Environment variables set:"
echo "  NATS_URL: $NATS_URL"
echo "  REDIS_HOST: $REDIS_HOST"
echo "  REDIS_PORT: $REDIS_PORT"
echo "  INSTANCE_ID: $INSTANCE_ID"

# Step 4: Build the application
print_status "Building the application..."
npm run build
print_success "Application built successfully"

# Step 5: Run the demo
print_status "Starting the JetStream demo..."
echo ""
echo "🎬 Demo will demonstrate:"
echo "  1. Single thread sequential processing"
echo "  2. Multiple threads concurrent processing"
echo "  3. Error handling"
echo "  4. Run cancellation"
echo ""

# Run the test script
if npx ts-node scripts/test-jetstream-system.ts; then
    print_success "Demo completed successfully!"
else
    print_error "Demo failed!"
    exit 1
fi

# Step 6: Show monitoring endpoints
echo ""
print_status "🔍 Monitoring endpoints available:"
echo "  - NATS Monitoring: http://localhost:8222"
echo "  - Application Health: http://localhost:3000/jetstream/health"
echo "  - Active Workers: http://localhost:3000/jetstream/workers/active"
echo "  - Active Locks: http://localhost:3000/jetstream/locks/active"
echo "  - Stream Info: http://localhost:3000/jetstream/streams/info"

# Step 7: Optional - Start the application server
read -p "Do you want to start the application server for manual testing? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Starting application server..."
    echo "Press Ctrl+C to stop the server"
    npm run start:dev
fi

print_success "Demo script completed!"