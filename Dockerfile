# Dockerfile para Railway - Frontend Next.js
FROM node:18-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache libc6-compat openssl-dev

# Copy package files
COPY frontend/package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install

# Copy all source code EXPLICITLY
COPY frontend/src/ ./src/
COPY frontend/public/ ./public/
COPY frontend/prisma/ ./prisma/
COPY frontend/types/ ./types/
COPY frontend/next.config.js ./
COPY frontend/tsconfig.json ./
COPY frontend/tailwind.config.js ./
COPY frontend/postcss.config.js ./
COPY frontend/jsconfig.json ./
COPY frontend/.env* ./

# Copy config files
COPY config/ ./config/
COPY metadata/ ./metadata/

# Debug: VERIFICAR SE ARQUIVOS FORAM COPIADOS
RUN echo "=== ESTRUTURA FINAL ===" && \
    ls -la ./ && \
    echo "=== PASTA SRC ===" && \
    ls -la ./src/ && \
    echo "=== PASTA LIB ===" && \
    ls -la ./src/lib/ && \
    echo "=== ARQUIVO API ===" && \
    ls -la ./src/lib/api.ts || echo "API.TS NAO ENCONTRADO!"

# Set environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=1

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Copy the standalone output
RUN mkdir -p ./standalone && \
    cp -r .next/standalone/* ./standalone/ && \
    mkdir -p ./standalone/public/logos

WORKDIR /app/standalone

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]