-- Script para criar usuário de exemplo
-- Execute este script no seu banco PostgreSQL

-- Criar customer de exemplo
INSERT INTO customers (name, slug, metadata_file, plan_type, is_active) 
VALUES ('Empresa Demo', 'demo', '/config/demo.toml', 'BASIC', true)
ON CONFLICT (slug) DO NOTHING;

-- Criar usuário admin de exemplo
-- Senha: admin123 (hash bcrypt)
INSERT INTO users (name, email, username, password, role, customer_id, is_active)
SELECT 
    'Administrador', 
    'admin@example.com', 
    'admin', 
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeWHfJq5BLb7.2VGe', -- admin123
    'ADMIN', 
    c.id, 
    true
FROM customers c 
WHERE c.slug = 'demo'
ON CONFLICT (email) DO NOTHING;