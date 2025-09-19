# Dockerfile para Railway - Frontend Next.js
FROM node:18-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache libc6-compat

# Copy package files
COPY frontend/package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install

# Copy all source code
COPY frontend/ .

# Copy config files
COPY config/ ./config/
COPY metadata/ ./metadata/

# Set environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Create upload directories
RUN mkdir -p ./public/logos

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]