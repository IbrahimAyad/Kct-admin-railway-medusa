#!/bin/bash
set -e

echo "Starting Medusa deployment..."

# Run migrations
echo "Running database migrations..."
npm run migrate || echo "Migration failed, continuing..."

# Build admin
echo "Building admin UI..."
npm run build:admin || echo "Admin build failed, continuing..."

# Run seeding
echo "Seeding database..."
npm run seed || echo "Seeding failed, continuing..."

# Start the server
echo "Starting server..."
npm start
