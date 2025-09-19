-- Criar tabela agent_customers se não existir
CREATE TABLE IF NOT EXISTS "agent_customers" (
    "agent_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "access_level" TEXT NOT NULL DEFAULT 'read',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_customers_pkey" PRIMARY KEY ("agent_id","customer_id")
);

-- Adicionar foreign keys se não existirem
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'agent_customers_agent_id_fkey'
    ) THEN
        ALTER TABLE "agent_customers" ADD CONSTRAINT "agent_customers_agent_id_fkey"
        FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'agent_customers_customer_id_fkey'
    ) THEN
        ALTER TABLE "agent_customers" ADD CONSTRAINT "agent_customers_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Migrar dados existentes se houver agentes com customer_id
-- (assumindo que pode haver agentes já ligados diretamente a customers)
INSERT INTO "agent_customers" ("agent_id", "customer_id", "access_level", "is_active", "created_at")
SELECT
    a.id as agent_id,
    a.customer_id,
    'admin' as access_level,
    true as is_active,
    CURRENT_TIMESTAMP as created_at
FROM "agents" a
WHERE a.customer_id IS NOT NULL
ON CONFLICT ("agent_id", "customer_id") DO NOTHING;

-- Criar diretório de config se não existir (para resolver erro do arquivo TOML)
-- Nota: isso precisa ser feito no sistema de arquivos, não no SQL

-- Criar arquivo demo.toml padrão (será feito em seguida)