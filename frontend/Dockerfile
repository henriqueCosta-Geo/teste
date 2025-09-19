FROM node:18-alpine

WORKDIR /app

# Instalar dependências do sistema (OpenSSL, netcat, etc.)
RUN apk add --no-cache openssl libc6-compat netcat-openbsd

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar código
COPY . .

# Criar script de inicialização
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "🚀 Starting Qdrant Admin Frontend..."' >> /app/start.sh && \
    echo 'echo "⏳ Waiting for PostgreSQL..."' >> /app/start.sh && \
    echo 'while ! nc -z postgres 5432; do sleep 1; done' >> /app/start.sh && \
    echo 'echo "✅ PostgreSQL is ready!"' >> /app/start.sh && \
    echo 'echo "📊 Creating missing tables..."' >> /app/start.sh && \
    echo 'npx prisma db execute --file ./create-auth-tables.sql || echo "Tables may already exist"' >> /app/start.sh && \
    echo 'echo "🔧 Generating Prisma client..."' >> /app/start.sh && \
    echo 'npx prisma generate' >> /app/start.sh && \
    echo 'echo "🎯 Starting Next.js application..."' >> /app/start.sh && \
    echo 'npm start' >> /app/start.sh && \
    chmod +x /app/start.sh

# Limpar cache e reinstalar para garantir compatibilidade
RUN npm ci

# Gerar Prisma client com versão específica
RUN npx prisma@5.7.0 generate

# Build da aplicação
RUN npm run build

# Expor porta
EXPOSE 3000

# Comando para produção
CMD ["/app/start.sh"]