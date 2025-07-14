# Multi-stage build for production
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN yarn build

# Production stage
FROM node:22-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /usr/src/app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copy package files
COPY package*.json yarn.lock ./

# Install production dependencies only
RUN yarn install --production --frozen-lockfile && yarn cache clean

# Copy built application from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Change ownership to non-root user
RUN chown -R nestjs:nodejs /usr/src/app
USER nestjs

# Expose port
EXPOSE 6789

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/health-check.js || exit 1

# Start application
CMD ["dumb-init", "node", "dist/main"]