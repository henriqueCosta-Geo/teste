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

# Debug: Check if files are copied correctly
RUN echo "=== Checking file structure ===" && \
    ls -la ./src/ && \
    echo "=== Checking lib directory ===" && \
    ls -la ./src/lib/ && \
    echo "=== Checking tsconfig ===" && \
    cat ./tsconfig.json

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development

# Generate Prisma client first
RUN npx prisma generate

# Install @types/node if missing
RUN npm install --save-dev @types/node

# Build application
RUN npm run build

# Create upload directories
RUN mkdir -p ./public/logos

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]