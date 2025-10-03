"""
Serviço para escrita de dados de Chat e Analytics no MongoDB
Implementa schema proposto: Collections "chats" e "analytics"
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import uuid

from mongo_service import MongoService

logger = logging.getLogger(__name__)


class MongoChatService:
    """Serviço para salvar chats e analytics no MongoDB"""

    def __init__(self, mongo_service: MongoService):
        self.mongo = mongo_service
        self.chats_collection = None
        self.analytics_collection = None

        # Inicializar coleções se MongoDB está conectado
        if mongo_service and mongo_service.is_connected:
            self.chats_collection = mongo_service.get_chats_collection()
            self.analytics_collection = mongo_service.get_analytics_collection()

    async def save_chat_session(
        self,
        chat_id: str,
        customer_id: Optional[int] = None,
        created_by: Optional[int] = None,
        agent_id: Optional[int] = None,
        team_id: Optional[int] = None
    ) -> bool:
        """Criar ou atualizar sessão de chat no MongoDB"""
        try:
            if self.chats_collection is None:
                logger.warning("⚠️ MongoDB não disponível - chat não será salvo")
                return False

            # Verificar se já existe
            existing = await self.chats_collection.find_one({"chat_id": chat_id})

            if existing:
                logger.debug(f"📝 [MONGO] Chat {chat_id} já existe - atualizando")
                return True  # Já existe, não precisa criar

            # Criar novo documento de chat
            chat_document = {
                "chat_id": chat_id,
                "customer_id": customer_id,
                "created_at": datetime.utcnow(),
                "created_by": created_by,
                "analise_id": None,  # Será preenchido ao finalizar chat
                "agent_id": agent_id,
                "team_id": team_id,
                "mensagens": []  # Array vazio inicialmente
            }

            await self.chats_collection.insert_one(chat_document)
            logger.info(f"✅ [MONGO] Chat session criada: {chat_id}")
            return True

        except Exception as e:
            logger.error(f"❌ [MONGO] Erro ao salvar chat session: {e}")
            return False

    async def add_message_to_chat(
        self,
        chat_id: str,
        message_type: str,
        content: str,
        metadata: Optional[Dict] = None
    ) -> bool:
        """Adicionar mensagem a um chat existente"""
        try:
            logger.info(f"🔍 [MONGO-DEBUG] Tentando salvar mensagem - chat_id: {chat_id}, type: {message_type}")

            if self.chats_collection is None:
                logger.error("❌ [MONGO-DEBUG] chats_collection é None!")
                logger.warning("⚠️ MongoDB não disponível - mensagem não será salva")
                return False

            logger.info(f"✅ [MONGO-DEBUG] chats_collection OK")

            # Verificar se chat existe antes de adicionar mensagem
            existing_chat = await self.chats_collection.find_one({"chat_id": chat_id})
            if not existing_chat:
                logger.error(f"❌ [MONGO-DEBUG] Chat {chat_id} NÃO EXISTE no MongoDB!")
                logger.error(f"   Não é possível adicionar mensagem a um chat inexistente")
                return False

            logger.info(f"✅ [MONGO-DEBUG] Chat {chat_id} encontrado no MongoDB")

            # Extrair informações do metadata
            rag_used = metadata.get("rag", False) if metadata else False
            user_assistant_id = metadata.get("agent_id") or metadata.get("team_id") if metadata else None
            tokens = metadata.get("tokens", {}) if metadata else {}
            input_tokens = tokens.get("input", 0)
            output_tokens = tokens.get("output", 0)
            token_total = input_tokens + output_tokens

            # Criar documento de mensagem
            message_document = {
                "mensagem_id": str(uuid.uuid4()),
                "rag": rag_used,
                "user_assistant_id": user_assistant_id,
                "message_type": message_type,  # 'user', 'agent', 'team'
                "feedback": None,  # Será preenchido quando houver feedback
                "mensagem": content[:100] + "..." if len(content) > 100 else content,  # Resumir para log
                "token_total": token_total,
                "tokens": {
                    "input": input_tokens,
                    "output": output_tokens
                },
                "created_at": datetime.utcnow()
            }

            # Log do documento sendo inserido (resumido)
            logger.info(f"📄 [MONGO-DEBUG] Documento a inserir:")
            logger.info(f"   - mensagem_id: {message_document['mensagem_id']}")
            logger.info(f"   - message_type: {message_type}")
            logger.info(f"   - content length: {len(content)} chars")

            # Criar documento REAL (sem truncar conteúdo)
            message_document_real = {
                "mensagem_id": message_document["mensagem_id"],
                "rag": rag_used,
                "user_assistant_id": user_assistant_id,
                "message_type": message_type,
                "feedback": None,
                "mensagem": content,  # Conteúdo completo
                "token_total": token_total,
                "tokens": {
                    "input": input_tokens,
                    "output": output_tokens
                },
                "created_at": datetime.utcnow()
            }

            # Adicionar mensagem ao array
            logger.info(f"⏳ [MONGO-DEBUG] Executando update_one...")
            result = await self.chats_collection.update_one(
                {"chat_id": chat_id},
                {"$push": {"mensagens": message_document_real}}
            )

            logger.info(f"📊 [MONGO-DEBUG] Resultado:")
            logger.info(f"   - matched_count: {result.matched_count}")
            logger.info(f"   - modified_count: {result.modified_count}")
            logger.info(f"   - upserted_id: {result.upserted_id}")

            if result.modified_count > 0:
                logger.info(f"✅ [MONGO] Mensagem adicionada ao chat {chat_id}")
                return True
            else:
                logger.error(f"❌ [MONGO] Chat {chat_id} não foi modificado! (matched: {result.matched_count})")
                return False

        except Exception as e:
            logger.error(f"❌ [MONGO] Erro ao adicionar mensagem: {e}")
            logger.exception(e)  # Stack trace completo
            return False

    async def update_message_feedback(
        self,
        chat_id: str,
        message_id: str,
        feedback: Dict[str, Any]
    ) -> bool:
        """Atualizar feedback de uma mensagem específica"""
        try:
            if self.chats_collection is None:
                return False

            result = await self.chats_collection.update_one(
                {
                    "chat_id": chat_id,
                    "mensagens.mensagem_id": message_id
                },
                {
                    "$set": {
                        "mensagens.$.feedback": feedback
                    }
                }
            )

            if result.modified_count > 0:
                logger.info(f"✅ [MONGO] Feedback atualizado para mensagem {message_id}")
                return True
            return False

        except Exception as e:
            logger.error(f"❌ [MONGO] Erro ao atualizar feedback: {e}")
            return False

    async def create_analysis(
        self,
        session_id: str,
        topics: List[str],
        main_topic: Optional[str] = None,
        sentiment: Optional[str] = None,
        category: Optional[str] = None,
        keywords: Optional[List[str]] = None
    ) -> Optional[str]:
        """Criar análise de um chat"""
        try:
            if self.analytics_collection is None:
                logger.warning("⚠️ MongoDB não disponível - análise não será salva")
                return None

            # Determinar tópico principal
            if not main_topic and topics:
                main_topic = topics[0]  # Pegar primeiro tópico como principal

            # Criar ID da análise
            analise_id = str(uuid.uuid4())

            # Criar documento de análise
            analysis_document = {
                "analise_id": analise_id,
                "session_id": session_id,
                "topico_principal": main_topic or "geral",
                "topicos": topics or [],
                "keywords": keywords or [],
                "sentiment": sentiment,
                "category": category,
                "created_at": datetime.utcnow()
            }

            await self.analytics_collection.insert_one(analysis_document)
            logger.info(f"✅ [MONGO] Análise criada: {analise_id}")

            # Atualizar chat com analise_id
            if self.chats_collection is not None:
                await self.chats_collection.update_one(
                    {"chat_id": session_id},
                    {"$set": {"analise_id": analise_id}}
                )
                logger.info(f"✅ [MONGO] Chat {session_id} linkado com análise {analise_id}")

            return analise_id

        except Exception as e:
            logger.error(f"❌ [MONGO] Erro ao criar análise: {e}")
            return None

    async def get_chat_with_messages(self, chat_id: str) -> Optional[Dict]:
        """Buscar chat completo com mensagens"""
        try:
            if self.chats_collection is None:
                return None

            chat = await self.chats_collection.find_one({"chat_id": chat_id})
            return chat

        except Exception as e:
            logger.error(f"❌ [MONGO] Erro ao buscar chat: {e}")
            return None

    async def get_customer_chats(
        self,
        customer_id: int,
        limit: int = 50,
        skip: int = 0
    ) -> List[Dict]:
        """Buscar chats de um customer"""
        try:
            if self.chats_collection is None:
                return []

            cursor = self.chats_collection.find(
                {"customer_id": customer_id}
            ).sort("created_at", -1).skip(skip).limit(limit)

            chats = await cursor.to_list(length=limit)
            return chats

        except Exception as e:
            logger.error(f"❌ [MONGO] Erro ao buscar chats do customer: {e}")
            return []

    async def get_analytics_by_topic(
        self,
        topic: str,
        limit: int = 100
    ) -> List[Dict]:
        """Buscar análises por tópico principal"""
        try:
            if self.analytics_collection is None:
                return []

            cursor = self.analytics_collection.find(
                {"topico_principal": topic}
            ).sort("created_at", -1).limit(limit)

            analytics = await cursor.to_list(length=limit)
            return analytics

        except Exception as e:
            logger.error(f"❌ [MONGO] Erro ao buscar analytics: {e}")
            return []


# ===============================
# FUNÇÃO DE CONVENIÊNCIA
# ===============================

def get_mongo_chat_service(mongo_service: MongoService) -> MongoChatService:
    """Criar instância do serviço de chat MongoDB"""
    return MongoChatService(mongo_service)
