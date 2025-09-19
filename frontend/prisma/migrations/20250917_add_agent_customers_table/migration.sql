-- CreateTable
CREATE TABLE "agent_customers" (
    "agent_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "access_level" TEXT NOT NULL DEFAULT 'read',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_customers_pkey" PRIMARY KEY ("agent_id","customer_id")
);

-- AddForeignKey
ALTER TABLE "agent_customers" ADD CONSTRAINT "agent_customers_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_customers" ADD CONSTRAINT "agent_customers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;