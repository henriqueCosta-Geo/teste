# Dockerfile para deploy no Railway - Frontend Next.js
FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache openssl libc6-compat curl

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend code
COPY frontend/ .

# Copy configuration files
COPY config/ ./config/
COPY metadata/ ./metadata/

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Create directories
RUN mkdir -p ./public/logos

# Expose port (Railway uses PORT env var)
EXPOSE 3000

# Start command
CMD ["npm", "start"]