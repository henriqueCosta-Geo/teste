"""
Script para garantir que existam usuários e customers básicos para primeiro login
"""
import logging
import bcrypt
from sqlalchemy.orm import Session
from database import SessionLocal

logger = logging.getLogger(__name__)

def ensure_admin_user():
    """
    Garante que existe um usuário SUPER_USER para primeiro acesso
    """
    db = SessionLocal()

    try:
        # Usar SQL direto para compatibilidade máxima

        # 1. Verificar se já existe SUPER_USER
        result = db.execute("SELECT COUNT(*) FROM users WHERE role = 'SUPER_USER'").fetchone()
        if result and result[0] > 0:
            logger.info("✅ Usuário SUPER_USER já existe")
            return

        logger.info("🔧 Criando usuário SUPER_USER para primeiro acesso...")

        # 2. Criar customer padrão (se não existir)
        db.execute("""
            INSERT INTO customers (name, slug, metadata_file, plan_type, is_active, created_at, updated_at)
            VALUES ('Sistema Admin', 'admin', '/config/admin.toml', 'ENTERPRISE', true, NOW(), NOW())
            ON CONFLICT (slug) DO NOTHING
        """)

        # 3. Pegar ID do customer
        customer_result = db.execute("SELECT id FROM customers WHERE slug = 'admin'").fetchone()
        customer_id = customer_result[0] if customer_result else None

        if not customer_id:
            raise Exception("Falha ao criar/encontrar customer admin")

        # 4. Criar usuário SUPER_USER
        # Senha: admin123
        password_hash = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        db.execute("""
            INSERT INTO users (name, email, username, password, role, customer_id, is_active, created_at, updated_at)
            VALUES ('Super Admin', 'admin@example.com', 'admin', %s, 'SUPER_USER', %s, true, NOW(), NOW())
            ON CONFLICT (email) DO NOTHING
        """, (password_hash, customer_id))

        # 5. Verificar se foi criado
        user_result = db.execute("SELECT email FROM users WHERE email = 'admin@example.com'").fetchone()
        if user_result:
            logger.info("✅ Usuário SUPER_USER criado com sucesso!")
            logger.info("   📧 Email: admin@example.com")
            logger.info("   🔑 Senha: admin123")
        else:
            logger.warning("⚠️ Usuário já existia, usando credenciais existentes")

        db.commit()

    except Exception as e:
        logger.error(f"❌ Erro ao criar usuário admin: {e}")
        db.rollback()
        # Não fazer raise para não quebrar a aplicação

    finally:
        db.close()

def ensure_demo_data():
    """
    Cria dados de demonstração incluindo customer demo e usuário
    """
    db = SessionLocal()

    try:
        logger.info("🔧 Verificando dados de demonstração...")

        # 1. Criar customer demo
        db.execute("""
            INSERT INTO customers (name, slug, metadata_file, plan_type, is_active, created_at, updated_at)
            VALUES ('Empresa Demo', 'demo', '/config/customers/demo.toml', 'BASIC', true, NOW(), NOW())
            ON CONFLICT (slug) DO NOTHING
        """)

        # 2. Pegar ID do customer demo
        customer_result = db.execute("SELECT id FROM customers WHERE slug = 'demo'").fetchone()
        customer_id = customer_result[0] if customer_result else None

        if customer_id:
            # 3. Criar usuário demo (se não existe)
            # Senha: demo123
            password_hash = bcrypt.hashpw("demo123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            db.execute("""
                INSERT INTO users (name, email, username, password, role, customer_id, is_active, created_at, updated_at)
                VALUES ('Usuário Demo', 'demo@example.com', 'demo', %s, 'ADMIN', %s, true, NOW(), NOW())
                ON CONFLICT (email) DO NOTHING
            """, (password_hash, customer_id))

            logger.info("✅ Dados demo configurados")
            logger.info("   📧 Demo: demo@example.com / demo123")

        db.commit()

    except Exception as e:
        logger.error(f"❌ Erro ao criar dados demo: {e}")
        db.rollback()

    finally:
        db.close()