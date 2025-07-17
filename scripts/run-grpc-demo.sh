#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored messages
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the Runtime directory"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules/@grpc" ]; then
    print_info "Installing gRPC dependencies..."
    npm install @grpc/grpc-js @grpc/proto-loader --legacy-peer-deps
    if [ $? -ne 0 ]; then
        print_error "Failed to install dependencies"
        exit 1
    fi
    print_success "Dependencies installed"
fi

# Get demo type from argument or default to 'single'
DEMO_TYPE=${1:-single}

print_info "Starting gRPC Demo..."
print_info "Demo type: $DEMO_TYPE"

# Check if TypeScript files exist
if [ ! -f "scripts/grpc_demo.ts" ]; then
    print_error "Demo files not found. Please ensure all gRPC demo files are in the scripts directory."
    exit 1
fi

# Compile and run the demo
print_info "Compiling and running gRPC demo..."
npx ts-node scripts/grpc_demo.ts "$DEMO_TYPE"

if [ $? -eq 0 ]; then
    print_success "gRPC demo completed successfully!"
else
    print_error "gRPC demo failed!"
    exit 1
fi 