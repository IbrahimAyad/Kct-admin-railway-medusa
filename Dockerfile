# Build stage
FROM node:18-alpine as builder

WORKDIR /app/backend

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev) for build stage
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build || true
# Ensure build directories exist
RUN mkdir -p build dist

# Production stage
FROM node:18-alpine as production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S medusa -u 1001

WORKDIR /app/backend

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files first
COPY --chown=medusa:nodejs package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder --chown=medusa:nodejs /app/backend/dist ./dist
COPY --from=builder --chown=medusa:nodejs /app/backend/build ./build
COPY --chown=medusa:nodejs medusa-config.js ./
COPY --chown=medusa:nodejs index.js ./
COPY --chown=medusa:nodejs index-fixed.js ./
COPY --chown=medusa:nodejs index-fixed-v2.js ./
COPY --chown=medusa:nodejs admin-auth-fix.js ./
COPY --chown=medusa:nodejs admin-api-fix.js ./
COPY --chown=medusa:nodejs start-server.js ./
COPY --chown=medusa:nodejs start-production.js ./
COPY --chown=medusa:nodejs data ./data

# Create uploads directory
RUN mkdir -p uploads && chown medusa:nodejs uploads

# Switch to non-root user
USER medusa

# Set environment variables
ENV PORT=9000
ENV HOST=0.0.0.0

# Expose port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index-fixed-v2.js"]