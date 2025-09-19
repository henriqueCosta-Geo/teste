-- Verificar e criar apenas as tabelas que estão realmente faltando

-- Primeiro, verificar se a tabela users existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        -- Criar enums se não existirem
        CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_USER');
        CREATE TYPE "PlanType" AS ENUM ('BASIC', 'PROFESSIONAL', 'ENTERPRISE');
        
        -- Criar tabela users
        CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password TEXT,
            "emailVerified" TIMESTAMP(3),
            image TEXT,
            role "UserRole" NOT NULL DEFAULT 'USER',
            customer_id INTEGER NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true,
            last_login TIMESTAMP(3),
            created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP(3)
        );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Enum types already exist';
END $$;

-- Tabela accounts (NextAuth)
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    
    CONSTRAINT accounts_provider_providerAccountId_key UNIQUE (provider, "providerAccountId")
);

-- Tabela sessions (NextAuth)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    "sessionToken" TEXT UNIQUE NOT NULL,
    "userId" INTEGER NOT NULL,
    expires TIMESTAMP(3) NOT NULL
);

-- Tabela verification_tokens (NextAuth)
CREATE TABLE IF NOT EXISTS verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT verification_tokens_identifier_token_key UNIQUE (identifier, token)
);

-- Foreign keys (só adiciona se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'accounts_userId_fkey'
    ) THEN
        ALTER TABLE accounts ADD CONSTRAINT accounts_userId_fkey 
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'sessions_userId_fkey'
    ) THEN
        ALTER TABLE sessions ADD CONSTRAINT sessions_userId_fkey 
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;