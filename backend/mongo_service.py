"""
Serviço de conexão e operações com MongoDB
Gerencia coleções de Analytics e Chat
"""

import os
import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

logger = logging.getLogger(__name__)


class MongoService:
    """Serviço para gerenciar conexão e operações MongoDB"""

    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None
        self.is_connected: bool = False

        # Configurações do .env
        self.mongo_url = os.getenv("MONGODB_URL")
        self.database_name = os.getenv("MONGODB_DATABASE", "IntelliPro")
        self.collection_chats = os.getenv("MONGODB_COLLECTION_CHATS", "chats")
        self.collection_analytics = os.getenv("MONGODB_COLLECTION_ANALYTICS", "analytics")

        logger.info(f"📦 MongoService configurado:")
        logger.info(f"   - Database: {self.database_name}")
        logger.info(f"   - Collection Chats: {self.collection_chats}")
        logger.info(f"   - Collection Analytics: {self.collection_analytics}")

    async def connect(self) -> bool:
        """Conectar ao MongoDB"""
        try:
            if not self.mongo_url:
                logger.warning("⚠️ MONGODB_URL não configurada - MongoDB será desabilitado")
                return False

            logger.info("🔌 Conectando ao MongoDB...")

            # Criar cliente MongoDB com timeout
            self.client = AsyncIOMotorClient(
                self.mongo_url,
                serverSelectionTimeoutMS=5000,  # 5 segundos timeout
                connectTimeoutMS=10000,         # 10 segundos timeout
                socketTimeoutMS=10000
            )

            # Selecionar database
            self.db = self.client[self.database_name]

            # Testar conexão
            await self.client.admin.command('ping')

            self.is_connected = True
            logger.info(f"✅ MongoDB conectado com sucesso!")
            logger.info(f"   - Database: {self.database_name}")

            # Criar índices automaticamente
            await self._create_indexes()

            return True

        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"❌ Falha ao conectar MongoDB: {e}")
            logger.warning("⚠️ Sistema continuará funcionando sem MongoDB")
            self.is_connected = False
            return False

        except Exception as e:
            logger.error(f"❌ Erro inesperado ao conectar MongoDB: {e}")
            self.is_connected = False
            return False

    async def close(self):
        """Fechar conexão MongoDB"""
        if self.client:
            logger.info("🔌 Fechando conexão MongoDB...")
            self.client.close()
            self.is_connected = False
            logger.info("✅ MongoDB desconectado")

    def get_chats_collection(self):
        """Obter coleção de chats"""
        if not self.is_connected or self.db is None:
            return None
        return self.db[self.collection_chats]

    def get_analytics_collection(self):
        """Obter coleção de analytics"""
        if not self.is_connected or self.db is None:
            return None
        return self.db[self.collection_analytics]

    async def _create_indexes(self):
        """Criar índices para performance"""
        try:
            if not self.is_connected:
                return

            logger.info("📊 Criando índices MongoDB...")

            # Índices para collection "chats"
            chats = self.get_chats_collection()
            if chats:
                # Índice por chat_id (único)
                await chats.create_index("chat_id", unique=True)
                # Índice por customer_id
                await chats.create_index("customer_id")
                # Índice por created_at (para queries temporais)
                await chats.create_index("created_at")
                # Índice composto customer + data
                await chats.create_index([("customer_id", 1), ("created_at", -1)])

                logger.info("   ✅ Índices criados para 'chats'")

            # Índices para collection "analytics"
            analytics = self.get_analytics_collection()
            if analytics:
                # Índice por analise_id (único)
                await analytics.create_index("analise_id", unique=True)
                # Índice por created_at
                await analytics.create_index("created_at")
                # Índice por tópico principal
                await analytics.create_index("topico_principal")

                logger.info("   ✅ Índices criados para 'analytics'")

            logger.info("✅ Todos os índices MongoDB criados com sucesso")

        except Exception as e:
            logger.warning(f"⚠️ Erro ao criar índices MongoDB: {e}")

    async def health_check(self) -> dict:
        """Verificar saúde da conexão MongoDB"""
        if not self.is_connected or self.client is None:
            return {
                "status": "disconnected",
                "message": "MongoDB não conectado"
            }

        try:
            # Ping no servidor
            await self.client.admin.command('ping')

            # Contar documentos nas coleções
            chats = self.get_chats_collection()
            analytics = self.get_analytics_collection()

            chats_count = await chats.count_documents({}) if chats else 0
            analytics_count = await analytics.count_documents({}) if analytics else 0

            return {
                "status": "connected",
                "database": self.database_name,
                "collections": {
                    "chats": chats_count,
                    "analytics": analytics_count
                }
            }

        except Exception as e:
            logger.error(f"❌ Health check MongoDB falhou: {e}")
            return {
                "status": "error",
                "message": str(e)
            }


# ===============================
# INSTÂNCIA GLOBAL
# ===============================

# Instância global do serviço
mongo_service = MongoService()


# Funções de conveniência
async def init_mongo():
    """Inicializar MongoDB"""
    return await mongo_service.connect()


async def close_mongo():
    """Fechar MongoDB"""
    await mongo_service.close()


def get_mongo_service() -> MongoService:
    """Obter instância do serviço MongoDB"""
    return mongo_service
