#!/bin/sh

echo "🚀 Starting Qdrant Admin Frontend..."

# Aguardar PostgreSQL estar pronto
echo "⏳ Waiting for PostgreSQL..."
while ! nc -z postgres 5432; do
  sleep 1
done
echo "✅ PostgreSQL is ready!"

# Executar migrações do Prisma
echo "📊 Running Prisma migrations..."
npx prisma migrate deploy

# Gerar Prisma client (já foi feito no build, mas garantir)
echo "🔧 Generating Prisma client..."
npx prisma generate

# Inicializar aplicação
echo "🎯 Starting Next.js application..."
npm start