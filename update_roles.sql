-- Atualizar enum UserRole para novos valores
-- Primeiro, criar novo enum
CREATE TYPE "UserRole_new" AS ENUM ('REGULAR', 'ADMIN', 'SUPER_USER');

-- Migrar dados existentes
-- USER -> REGULAR
-- ADMIN -> ADMIN (permanece)
-- SUPER_USER -> SUPER_USER (permanece)
UPDATE "users" SET role = 'REGULAR' WHERE role = 'USER';

-- Alterar coluna para usar novo tipo
ALTER TABLE "users" ALTER COLUMN role TYPE "UserRole_new" USING role::text::"UserRole_new";

-- Atualizar valor padrão da coluna
ALTER TABLE "users" ALTER COLUMN role SET DEFAULT 'REGULAR';

-- Dropar enum antigo e renomear novo
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";