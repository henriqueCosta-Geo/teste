"""
Serviço para escrita de dados de Chat e Analytics no MongoDB
Implementa schema proposto: Collections "chats" e "analytics"
"""

import logging
import re
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

    @staticmethod
    def normalize_tokens(tokens_raw: Any) -> Dict[str, int]:
        """
        Normaliza dados de tokens vindos do Agno/OpenAI para formato padrão

        Suporta múltiplos formatos:
        - {'input': X, 'output': Y, 'total': Z}
        - {'input_tokens': X, 'output_tokens': Y, 'total_tokens': Z}
        - {'prompt_tokens': X, 'completion_tokens': Y, 'total_tokens': Z}

        Returns:
            Dict com formato padronizado: {'input': int, 'output': int, 'total': int}
        """
        if not tokens_raw or not isinstance(tokens_raw, dict):
            logger.warning(f"⚠️ [TOKENS] Formato inválido recebido: {tokens_raw}")
            return {'input': 0, 'output': 0, 'total': 0}

        # Log do formato bruto recebido
        logger.info(f"🔢 [TOKENS-DEBUG] Raw recebido: {tokens_raw}")

        # Tentar extrair valores em diferentes formatos
        input_tokens = (
            tokens_raw.get('input') or
            tokens_raw.get('input_tokens') or
            tokens_raw.get('prompt_tokens') or
            0
        )

        output_tokens = (
            tokens_raw.get('output') or
            tokens_raw.get('output_tokens') or
            tokens_raw.get('completion_tokens') or
            0
        )

        total_tokens = tokens_raw.get('total') or tokens_raw.get('total_tokens') or 0

        # Se total não veio, calcular
        if total_tokens == 0 and (input_tokens > 0 or output_tokens > 0):
            total_tokens = input_tokens + output_tokens

        normalized = {
            'input': int(input_tokens),
            'output': int(output_tokens),
            'total': int(total_tokens)
        }

        logger.info(f"🔢 [TOKENS-DEBUG] Normalizado: {normalized}")

        return normalized

    @staticmethod
    def extract_agent_id(agent_identifier: Any) -> Any:
        """
        Extrai ID numérico ou nome do agente de diferentes formatos

        Converte:
        - 'agent-7' -> 7
        - 7 -> 7
        - 'Coordenador' -> 'Coordenador'
        - 'coordenador' -> 'Coordenador'

        Returns:
            int (ID do agente) ou str ('Coordenador')
        """
        if agent_identifier is None:
            return None

        # Já é int
        if isinstance(agent_identifier, int):
            return agent_identifier

        # É string
        if isinstance(agent_identifier, str):
            # Coordenador (case insensitive)
            if agent_identifier.lower() == "coordenador":
                return "Coordenador"

            # Formato "agent-7" ou "agent-ID"
            match = re.match(r'agent-(\d+)', agent_identifier, re.IGNORECASE)
            if match:
                return int(match.group(1))

            # Tentar converter direto para int
            try:
                return int(agent_identifier)
            except ValueError:
                pass

        # Retornar como está se não conseguir processar
        logger.warning(f"⚠️ [AGENT-ID] Formato não reconhecido: {agent_identifier}")
        return agent_identifier

    def validate_and_enrich_metadata(self, metadata: Optional[Dict], message_type: str) -> Dict:
        """
        Valida e enriquece metadata antes de salvar no MongoDB

        Args:
            metadata: Metadata bruto recebido
            message_type: Tipo da mensagem ('user', 'agent', 'team')

        Returns:
            Dict com metadata validado e normalizado
        """
        if not metadata:
            metadata = {}

        # Normalizar tokens
        tokens_raw = metadata.get('tokens', {})
        normalized_tokens = self.normalize_tokens(tokens_raw)

        # Extrair e normalizar agent_id
        agent_id_raw = metadata.get('agent_id')
        if not agent_id_raw and message_type in ['team', 'agent']:
            # Tentar pegar de agents_involved
            agents_involved = metadata.get('agents_involved', [])
            if agents_involved and len(agents_involved) > 0:
                agent_id_raw = agents_involved[0]

        agent_id = self.extract_agent_id(agent_id_raw) if agent_id_raw else None

        # Construir metadata enriquecido
        enriched = {
            **metadata,
            'tokens_normalized': normalized_tokens,
            'agent_id_normalized': agent_id,
            'validated_at': datetime.utcnow().isoformat()
        }

        logger.info(f"✅ [VALIDATION] Metadata enriquecido para {message_type}")
        logger.info(f"   - Tokens: {normalized_tokens}")
        logger.info(f"   - Agent ID: {agent_id}")

        return enriched

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
    ) -> Optional[str]:
        """
        Adicionar mensagem a um chat existente

        Returns:
            str: mensagem_id se bem sucedido, None se falhar
        """
        try:
            logger.info(f"🔍 [MONGO-DEBUG] Tentando salvar mensagem - chat_id: {chat_id}, type: {message_type}")

            if self.chats_collection is None:
                logger.error("❌ [MONGO-DEBUG] chats_collection é None!")
                logger.warning("⚠️ MongoDB não disponível - mensagem não será salva")
                return None

            logger.info(f"✅ [MONGO-DEBUG] chats_collection OK")

            # Verificar se chat existe antes de adicionar mensagem
            existing_chat = await self.chats_collection.find_one({"chat_id": chat_id})
            if not existing_chat:
                logger.error(f"❌ [MONGO-DEBUG] Chat {chat_id} NÃO EXISTE no MongoDB!")
                logger.error(f"   Não é possível adicionar mensagem a um chat inexistente")
                return None

            logger.info(f"✅ [MONGO-DEBUG] Chat {chat_id} encontrado no MongoDB")

            # ✅ VALIDAR E ENRIQUECER METADATA
            enriched_metadata = self.validate_and_enrich_metadata(metadata, message_type)

            # Extrair valores normalizados
            tokens_normalized = enriched_metadata.get('tokens_normalized', {'input': 0, 'output': 0, 'total': 0})
            agent_id_normalized = enriched_metadata.get('agent_id_normalized')

            # user_assistant_id para diferentes tipos de mensagem
            user_assistant_id = None
            if message_type == "user":
                user_assistant_id = metadata.get("user_id") or metadata.get("customer_id") if metadata else None
            elif message_type in ["team", "agent"]:
                user_assistant_id = agent_id_normalized

            # Extrair informações adicionais do metadata
            rag_used = metadata.get("rag", False) if metadata else False
            rag_sources = metadata.get("rag_sources", []) if metadata else []
            model_used = metadata.get("model", metadata.get("model_used", "unknown")) if metadata else "unknown"
            execution_time_ms = metadata.get("execution_time_ms", 0) if metadata else 0
            success = metadata.get("success", True) if metadata else True
            error = metadata.get("error", None) if metadata else None
            agent_name = metadata.get("agent_name", None) if metadata else None
            team_id = metadata.get("team_id", None) if metadata else None
            team_name = metadata.get("team_name", None) if metadata else None

            # Gerar mensagem_id
            mensagem_id = str(uuid.uuid4())

            # Criar documento de mensagem COMPLETO
            message_document = {
                "mensagem_id": mensagem_id,
                "message_type": message_type,
                "mensagem": content,

                # User/Agent identification
                "user_assistant_id": user_assistant_id,
                "agent_name": agent_name,

                # Team info
                "team_id": team_id,
                "team_name": team_name,

                # Tokens
                "token_total": tokens_normalized['total'],
                "tokens": {
                    "input": tokens_normalized['input'],
                    "output": tokens_normalized['output']
                },

                # RAG info
                "rag": rag_used,
                "rag_sources": rag_sources[:5] if rag_sources else [],  # Limitar a 5 sources
                "rag_chunks_count": len(rag_sources) if rag_sources else 0,

                # Model & Performance
                "model_used": model_used,
                "execution_time_ms": execution_time_ms,

                # Status
                "success": success,
                "error": error,

                # Feedback (será preenchido depois)
                "feedback": None,

                # Timestamps
                "created_at": datetime.utcnow()
            }

            # Log do documento sendo inserido (resumido)
            logger.info(f"📄 [MONGO-SAVE] Documento a inserir:")
            logger.info(f"   - mensagem_id: {mensagem_id}")
            logger.info(f"   - message_type: {message_type}")
            logger.info(f"   - content length: {len(content)} chars")
            logger.info(f"   - user_assistant_id: {user_assistant_id}")
            logger.info(f"   - agent_name: {agent_name}")
            logger.info(f"   - tokens: {tokens_normalized}")
            logger.info(f"   - model: {model_used}")
            logger.info(f"   - rag_used: {rag_used}, chunks: {len(rag_sources)}")
            logger.info(f"   - execution_time_ms: {execution_time_ms}")
            logger.info(f"   - success: {success}")

            # Adicionar mensagem ao array
            logger.info(f"⏳ [MONGO-DEBUG] Executando update_one...")
            result = await self.chats_collection.update_one(
                {"chat_id": chat_id},
                {"$push": {"mensagens": message_document}}
            )

            logger.info(f"📊 [MONGO-DEBUG] Resultado:")
            logger.info(f"   - matched_count: {result.matched_count}")
            logger.info(f"   - modified_count: {result.modified_count}")
            logger.info(f"   - upserted_id: {result.upserted_id}")

            if result.modified_count > 0:
                logger.info(f"✅ [MONGO] Mensagem adicionada ao chat {chat_id} com ID {mensagem_id}")
                return mensagem_id
            else:
                logger.error(f"❌ [MONGO] Chat {chat_id} não foi modificado! (matched: {result.matched_count})")
                return None

        except Exception as e:
            logger.error(f"❌ [MONGO] Erro ao adicionar mensagem: {e}")
            logger.exception(e)  # Stack trace completo
            return None

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
