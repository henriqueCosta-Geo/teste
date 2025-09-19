"""
Sistema completo de coleta de métricas em tempo real para agentes IA
Usando Redis para filas assíncronas e processamento inteligente
"""

import asyncio
import json
import time
import re
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
import redis.asyncio as redis
import logging
from database import get_db
import agent_models

logger = logging.getLogger(__name__)

class MetricsCollector:
    """Coletor principal de métricas com Redis"""
    
    def __init__(self, redis_url: str = "redis://redis:6379"):
        self.redis_url = redis_url
        self.redis_client = None
        self.running = False
        
        # Filas Redis
        self.EXECUTION_QUEUE = "metrics:execution"
        self.CONTENT_QUEUE = "metrics:content" 
        self.SESSION_QUEUE = "metrics:session"
        self.CLASSIFICATION_QUEUE = "metrics:classification"
        
        # Cache para sessões ativas
        self.active_sessions = {}
        
    async def initialize(self):
        """Inicializar conexão Redis"""
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            await self.redis_client.ping()
            logger.info("🔗 Redis conectado para métricas")
            return True
        except Exception as e:
            logger.error(f"❌ Erro ao conectar Redis: {e}")
            return False
    
    async def start_workers(self):
        """Iniciar workers assíncronos"""
        if not self.redis_client:
            await self.initialize()
        
        self.running = True
        
        # Iniciar workers em paralelo
        workers = [
            self._execution_worker(),
            self._content_worker(), 
            self._session_worker(),
            self._classification_worker(),
            self._cleanup_worker(),
            self._auto_analysis_worker()  # Novo worker para análise automática
        ]
        
        logger.info("🚀 Workers de métricas iniciados")
        await asyncio.gather(*workers)
    
    async def stop_workers(self):
        """Parar workers"""
        self.running = False
        if self.redis_client:
            await self.redis_client.close()
        logger.info("⏹️ Workers de métricas parados")
    
    # ===============================
    # COLETA DE MÉTRICAS
    # ===============================
    
    async def collect_execution_metrics(self, data: Dict[str, Any]):
        """Coletar métricas de execução de agente"""
        try:
            # Verificar se Redis está conectado
            if not self.redis_client:
                logger.warning("⚠️ Redis não conectado - salvando métrica diretamente no banco")
                await self._save_execution_to_db(data)
                return
            
            # Se não há tokens reais, estimar
            if not data.get('input_tokens') and data.get('input_text'):
                data['input_tokens'] = self.estimate_tokens(data['input_text'])
            if not data.get('output_tokens') and data.get('output_text'):
                data['output_tokens'] = self.estimate_tokens(data['output_text'])
            
            # Calcular custo se não fornecido
            if not data.get('cost_estimate') and data.get('input_tokens') and data.get('output_tokens'):
                data['cost_estimate'] = self.calculate_cost(
                    data.get('model', 'gpt-4o-mini'),
                    data['input_tokens'],
                    data['output_tokens']
                )
            
            await self.redis_client.lpush(self.EXECUTION_QUEUE, json.dumps(data))
            logger.debug(f"📊 Métrica de execução coletada: {data.get('agent_id', 'N/A')}")
        except Exception as e:
            logger.error(f"❌ Erro ao coletar métrica de execução: {e}")
    
    async def collect_content_metrics(self, data: Dict[str, Any]):
        """Coletar métricas de conteúdo para análise de tópicos"""
        try:
            if not self.redis_client:
                logger.warning("⚠️ Redis não conectado - salvando conteúdo diretamente no banco")
                await self._save_content_to_db(data)
                return
                
            await self.redis_client.lpush(self.CONTENT_QUEUE, json.dumps(data))
            logger.debug(f"📝 Métrica de conteúdo coletada: {data.get('session_id', 'N/A')}")
        except Exception as e:
            logger.error(f"❌ Erro ao coletar métrica de conteúdo: {e}")
    
    async def collect_session_metrics(self, data: Dict[str, Any]):
        """Coletar métricas de sessão de chat"""
        try:
            if not self.redis_client:
                logger.warning("⚠️ Redis não conectado - salvando sessão diretamente no banco")
                await self._save_session_to_db(data)
                return
                
            await self.redis_client.lpush(self.SESSION_QUEUE, json.dumps(data))
            
            # Atualizar cache de sessões ativas
            session_id = data.get('session_id')
            if session_id:
                self.active_sessions[session_id] = {
                    'user_id': data.get('user_id'),
                    'agent_id': data.get('agent_id'),
                    'team_id': data.get('team_id'),
                    'start_time': data.get('timestamp', datetime.now().isoformat()),
                    'message_count': data.get('message_count', 1),
                    'last_activity': datetime.now().isoformat()
                }
            
            logger.debug(f"💬 Métrica de sessão coletada: {session_id}")
        except Exception as e:
            logger.error(f"❌ Erro ao coletar métrica de sessão: {e}")
    
    async def request_conversation_classification(self, session_id: str, conversation_data: Dict[str, Any]):
        """Solicitar classificação inteligente de conversa"""
        try:
            classification_data = {
                'session_id': session_id,
                'conversation_data': conversation_data,
                'timestamp': datetime.now().isoformat(),
                'request_id': str(uuid.uuid4())
            }
            
            # Verificar se Redis está disponível
            if not self.redis_client:
                logger.warning("⚠️ Redis não conectado - processando classificação diretamente")
                await self._process_conversation_classification(classification_data)
                return
            
            await self.redis_client.lpush(self.CLASSIFICATION_QUEUE, json.dumps(classification_data))
            logger.info(f"🤖 Classificação solicitada para sessão: {session_id}")
            
        except Exception as e:
            logger.error(f"❌ Erro ao solicitar classificação: {e}")
            # Fallback direto para processamento
            try:
                classification_data = {
                    'session_id': session_id,
                    'conversation_data': conversation_data,
                    'timestamp': datetime.now().isoformat(),
                    'request_id': str(uuid.uuid4())
                }
                await self._process_conversation_classification(classification_data)
            except Exception as fallback_error:
                logger.error(f"❌ Erro no fallback de classificação: {fallback_error}")
    
    # ===============================
    # WORKERS ASSÍNCRONOS
    # ===============================
    
    async def _execution_worker(self):
        """Worker para processar métricas de execução"""
        logger.info("🔄 Worker de execução iniciado")
        
        while self.running:
            try:
                # Processar em lote para performance
                items = []
                for _ in range(10):  # Lote de até 10 itens
                    item = await self.redis_client.brpop(self.EXECUTION_QUEUE, timeout=1)
                    if item:
                        items.append(json.loads(item[1]))
                    else:
                        break
                
                if items:
                    await self._process_execution_batch(items)
                    
            except Exception as e:
                logger.error(f"❌ Erro no worker de execução: {e}")
                await asyncio.sleep(1)
    
    async def _content_worker(self):
        """Worker para processar análise de conteúdo"""
        logger.info("🔄 Worker de conteúdo iniciado")
        
        while self.running:
            try:
                item = await self.redis_client.brpop(self.CONTENT_QUEUE, timeout=5)
                if item:
                    data = json.loads(item[1])
                    await self._process_content_analysis(data)
                    
            except Exception as e:
                logger.error(f"❌ Erro no worker de conteúdo: {e}")
                await asyncio.sleep(1)
    
    async def _session_worker(self):
        """Worker para processar métricas de sessão"""
        logger.info("🔄 Worker de sessão iniciado")
        
        while self.running:
            try:
                item = await self.redis_client.brpop(self.SESSION_QUEUE, timeout=5)
                if item:
                    data = json.loads(item[1])
                    await self._process_session_metrics(data)
                    
            except Exception as e:
                logger.error(f"❌ Erro no worker de sessão: {e}")
                await asyncio.sleep(1)
    
    async def _classification_worker(self):
        """Worker para classificação inteligente de conversas"""
        logger.info("🔄 Worker de classificação iniciado")
        
        while self.running:
            try:
                item = await self.redis_client.brpop(self.CLASSIFICATION_QUEUE, timeout=10)
                if item:
                    data = json.loads(item[1])
                    await self._process_conversation_classification(data)
                    
            except Exception as e:
                logger.error(f"❌ Erro no worker de classificação: {e}")
                await asyncio.sleep(1)
    
    async def _cleanup_worker(self):
        """Worker para limpeza de dados antigos"""
        logger.info("🔄 Worker de limpeza iniciado")
        
        while self.running:
            try:
                # Executar limpeza a cada 1 hora
                await asyncio.sleep(3600)
                await self._cleanup_old_data()
                
            except Exception as e:
                logger.error(f"❌ Erro no worker de limpeza: {e}")

    async def _auto_analysis_worker(self):
        """Worker para análise automática por timeout"""
        logger.info("🔄 Worker de análise automática iniciado")
        
        while self.running:
            try:
                # Verificar sessões inativas a cada 5 minutos
                await asyncio.sleep(300)
                await self._check_inactive_sessions()
                
            except Exception as e:
                logger.error(f"❌ Erro no worker de análise automática: {e}")
    
    # ===============================
    # PROCESSADORES
    # ===============================
    
    async def _process_execution_batch(self, items: List[Dict[str, Any]]):
        """Processar lote de métricas de execução"""
        from database import SessionLocal
        
        db = SessionLocal()
        try:
            for item in items:
                # Salvar métricas de tokens
                if item.get('input_tokens') or item.get('output_tokens'):
                    db.execute(text("""
                        INSERT INTO token_usage (
                            agent_id, session_id, model_used, input_tokens, 
                            output_tokens, cost_estimate, operation_type, created_at
                        ) VALUES (
                            :agent_id, :session_id, :model, :input_tokens,
                            :output_tokens, :cost, :operation_type, :timestamp
                        )
                    """), {
                        'agent_id': item.get('agent_id'),
                        'session_id': item.get('session_id'),
                        'model': item.get('model', 'unknown'),
                        'input_tokens': item.get('input_tokens', 0),
                        'output_tokens': item.get('output_tokens', 0),
                        'cost': item.get('cost_estimate', 0.0),
                        'operation_type': item.get('operation_type', 'chat'),
                        'timestamp': item.get('timestamp', datetime.now())
                    })
                
                # NOVO: Salvar na tabela agent_executions para cálculo de tempo médio
                if item.get('agent_id'):
                    db.execute(text("""
                        INSERT INTO agent_executions (
                            agent_id, input_text, output_text, tools_used, 
                            execution_time_ms, tokens_used, created_at
                        ) VALUES (
                            :agent_id, :input_text, :output_text, :tools_used,
                            :execution_time_ms, :tokens_used, :timestamp
                        )
                    """), {
                        'agent_id': item.get('agent_id'),
                        'input_text': str(item.get('input_text', ''))[:1000],
                        'output_text': str(item.get('output_text', ''))[:2000],
                        'tools_used': str(item.get('tools_used', [])),
                        'execution_time_ms': item.get('execution_time', item.get('execution_time_ms', 0)),
                        'tokens_used': item.get('input_tokens', 0) + item.get('output_tokens', 0),
                        'timestamp': item.get('timestamp', datetime.now())
                    })
                
                # Atualizar performance_metrics
                db.execute(text("""
                    INSERT INTO performance_metrics (
                        agent_id, metric_date, total_interactions, 
                        avg_response_time_ms, tokens_consumed
                    ) VALUES (
                        :agent_id, :date, 1, :response_time, :tokens
                    ) ON CONFLICT (agent_id, metric_date) 
                    DO UPDATE SET
                        total_interactions = performance_metrics.total_interactions + 1,
                        avg_response_time_ms = (
                            performance_metrics.avg_response_time_ms + :response_time
                        ) / 2,
                        tokens_consumed = performance_metrics.tokens_consumed + :tokens
                """), {
                    'agent_id': item.get('agent_id'),
                    'date': datetime.now().date(),
                    'response_time': item.get('execution_time_ms', 0),
                    'tokens': (item.get('input_tokens', 0) + item.get('output_tokens', 0))
                })
            
            db.commit()
            logger.debug(f"💾 Processadas {len(items)} métricas de execução")
            
        except Exception as e:
            logger.error(f"❌ Erro ao processar lote de execução: {e}")
            db.rollback()
        finally:
            db.close()
    
    async def _process_content_analysis(self, data: Dict[str, Any]):
        """Processar análise de conteúdo para extrair tópicos"""
        from database import SessionLocal
        
        db = SessionLocal()
        try:
            content = data.get('message_content', '')
            
            # Extração simples de tópicos usando regex
            topics = self._extract_topics(content)
            keywords = self._extract_keywords(content)
            
            if topics:
                import json as json_lib
                db.execute(text("""
                    INSERT INTO content_topics (
                        session_id, agent_id, extracted_topics, 
                        message_content, topic_keywords, confidence_score, created_at
                    ) VALUES (
                        :session_id, :agent_id, :topics, 
                        :content, :keywords, :confidence, :timestamp
                    )
                """), {
                    'session_id': data.get('session_id'),
                    'agent_id': data.get('agent_id'),
                    'topics': json_lib.dumps(topics),
                    'content': content[:500],  # Limitar tamanho
                    'keywords': json_lib.dumps(keywords),
                    'confidence': data.get('confidence_score', 0.8),
                    'timestamp': data.get('timestamp', datetime.now())
                })
                
                db.commit()
                logger.debug(f"🏷️ Tópicos extraídos: {topics}")
        
        except Exception as e:
            logger.error(f"❌ Erro ao processar análise de conteúdo: {e}")
            db.rollback()
        finally:
            db.close()
    
    async def _process_session_metrics(self, data: Dict[str, Any]):
        """Processar métricas de sessão"""
        from database import SessionLocal
        
        db = SessionLocal()
        try:
            session_id = data.get('session_id')
            
            # Inserir ou atualizar user_metrics
            db.execute(text("""
                INSERT INTO user_metrics (
                    user_id, session_id, agent_id, total_messages,
                    session_duration_seconds, created_at, updated_at
                ) VALUES (
                    :user_id, :session_id, :agent_id, :messages,
                    :duration, :timestamp, :timestamp
                ) ON CONFLICT (user_id, session_id)
                DO UPDATE SET
                    total_messages = user_metrics.total_messages + :messages,
                    updated_at = :timestamp
            """), {
                'user_id': data.get('user_id', 'anonymous'),
                'session_id': session_id,
                'agent_id': data.get('agent_id'),
                'messages': data.get('message_count', 1),
                'duration': data.get('duration_seconds', 0),
                'timestamp': data.get('timestamp', datetime.now())
            })
            
            db.commit()
            logger.debug(f"👤 Métricas de sessão processadas: {session_id}")
            
        except Exception as e:
            logger.error(f"❌ Erro ao processar métricas de sessão: {e}")
            db.rollback()
        finally:
            db.close()
    
    async def _process_conversation_classification(self, data: Dict[str, Any]):
        """Processar classificação inteligente usando agente especialista"""
        try:
            from agents import AgentManager
            from qdrant_service import QdrantService
            from database import SessionLocal
            
            db = SessionLocal()
            qdrant_service = QdrantService()
            agent_manager = AgentManager(db, qdrant_service)
            
            # Configuração do agente classificador
            classifier_config = {
                "id": 9999,  # ID especial para classificador
                "name": "Classificador de Conversas",
                "role": "Especialista em análise e classificação de conversas",
                "model": "gpt-4o-mini",
                "temperature": 0.1,
                "instructions": """
                Você é um especialista em análise de conversas de suporte técnico.
                
                Analise a conversa fornecida e extraia:
                1. Tópicos principais mencionados
                2. Sentimento do usuário (positivo/negativo/neutro)
                3. Nível de satisfação estimado (1-5)
                4. Categoria do problema (técnico, comercial, suporte, etc.)
                5. Complexidade da solução (baixa, média, alta)
                6. Palavras-chave relevantes
                
                Responda APENAS em formato JSON:
                {
                    "topics": ["tópico1", "tópico2"],
                    "sentiment": "positivo|negativo|neutro",
                    "satisfaction": 1-5,
                    "category": "categoria",
                    "complexity": "baixa|média|alta",
                    "keywords": ["palavra1", "palavra2"],
                    "summary": "resumo de 1 linha"
                }
                """,
                "tools_config": []
            }
            
            # Preparar prompt com a conversa
            conversation_data = data.get('conversation_data', {})
            messages = conversation_data.get('messages', [])
            
            conversation_text = "\n".join([
                f"{msg.get('sender', 'user')}: {msg.get('content', '')[:200]}"
                for msg in messages[-10:]  # Últimas 10 mensagens
            ])
            
            prompt = f"""
            Analise esta conversa de suporte técnico:
            
            {conversation_text}
            
            Forneça a análise em formato JSON conforme instruído.
            """
            
            # Executar classificação
            result = agent_manager.execute_agent_task(
                classifier_config, 
                prompt, 
                f"classification_{data.get('session_id')}"
            )
            
            if result.get('success'):
                try:
                    # Tentar parsear JSON da resposta
                    response_text = result.get('response', '{}')
                    # Extrair JSON se estiver dentro de código markdown
                    if '```json' in response_text:
                        response_text = response_text.split('```json')[1].split('```')[0]
                    elif '```' in response_text:
                        response_text = response_text.split('```')[1].split('```')[0]
                    
                    classification = json.loads(response_text)
                    
                    # Salvar classificação no banco
                    db.execute(text("""
                        INSERT INTO user_feedback (
                            session_id, user_id, agent_id, rating, 
                            issue_category, feedback_comment, created_at
                        ) VALUES (
                            :session_id, :user_id, :agent_id, :rating,
                            :category, :summary, :timestamp
                        )
                    """), {
                        'session_id': data.get('session_id'),
                        'user_id': conversation_data.get('user_id', 'classified'),
                        'agent_id': conversation_data.get('agent_id'),
                        'rating': classification.get('satisfaction', 3),
                        'category': classification.get('category', 'geral'),
                        'summary': classification.get('summary', 'Classificação automática'),
                        'timestamp': datetime.now()
                    })
                    
                    # Salvar tópicos extraídos
                    if classification.get('topics'):
                        import json as json_lib
                        db.execute(text("""
                            INSERT INTO content_topics (
                                session_id, agent_id, extracted_topics,
                                topic_keywords, confidence_score, created_at
                            ) VALUES (
                                :session_id, :agent_id, :topics,
                                :keywords, :confidence, :timestamp
                            )
                        """), {
                            'session_id': data.get('session_id'),
                            'agent_id': conversation_data.get('agent_id'),
                            'topics': json_lib.dumps(classification.get('topics', [])),
                            'keywords': json_lib.dumps(classification.get('keywords', [])),
                            'confidence': 0.9,  # Alta confiança para classificação IA
                            'timestamp': datetime.now()
                        })
                    
                    db.commit()
                    logger.info(f"🎯 Conversa classificada: {classification.get('summary', 'N/A')}")
                
                except json.JSONDecodeError as e:
                    logger.warning(f"⚠️ Resposta de classificação não é JSON válido: {e}")
                    
            else:
                logger.warning(f"⚠️ Falha na classificação da conversa: {result.get('error', 'N/A')}")
                
            db.close()
            
        except Exception as e:
            logger.error(f"❌ Erro na classificação de conversa: {e}")
    
    async def _cleanup_old_data(self):
        """Limpar dados antigos para otimizar performance"""
        from database import SessionLocal
        
        db = SessionLocal()
        try:
            # Limpar sessões ativas antigas (mais de 24h)
            cutoff_time = datetime.now() - timedelta(hours=24)
            old_sessions = [
                sid for sid, data in self.active_sessions.items()
                if datetime.fromisoformat(data['last_activity']) < cutoff_time
            ]
            
            for session_id in old_sessions:
                del self.active_sessions[session_id]
            
            logger.info(f"🧹 Limpeza concluída: {len(old_sessions)} sessões removidas")
            
        except Exception as e:
            logger.error(f"❌ Erro na limpeza: {e}")
        finally:
            db.close()
    
    async def _check_inactive_sessions(self):
        """Verificar sessões inativas para análise automática por timeout"""
        from database import SessionLocal
        from chat_service import ChatService
        
        db = SessionLocal()
        chat_service = ChatService(db)
        
        try:
            # Buscar sessões com última atividade há mais de 15 minutos
            cutoff_time = datetime.now() - timedelta(minutes=15)
            
            inactive_sessions = db.execute(text("""
                SELECT DISTINCT cs.session_id, cs.team_id, cs.last_activity
                FROM chat_sessions cs
                WHERE cs.last_activity < :cutoff_time
                AND cs.session_id NOT IN (
                    SELECT session_id FROM user_feedback 
                    WHERE session_id = cs.session_id
                    AND auto_generated = true
                )
                ORDER BY cs.last_activity DESC
                LIMIT 10
            """), {'cutoff_time': cutoff_time}).fetchall()
            
            analyzed_count = 0
            
            for session_record in inactive_sessions:
                session_id = session_record.session_id
                team_id = session_record.team_id
                
                try:
                    # Obter mensagens da sessão
                    messages = chat_service.get_chat_history(session_id)
                    
                    if messages and len(messages) >= 3:  # Mínimo 3 mensagens
                        conversation_data = {
                            'session_id': session_id,
                            'messages': messages,
                            'total_messages': len(messages),
                            'auto_triggered': True,
                            'trigger_reason': 'inactivity_timeout',
                            'user_id': 'auto_timeout',
                            'team_id': team_id,
                            'inactive_since': session_record.last_activity.isoformat()
                        }
                        
                        # Solicitar classificação
                        await self.request_conversation_classification(session_id, conversation_data)
                        analyzed_count += 1
                        
                        logger.info(f"⏰ Análise por timeout disparada: {session_id} (inativo desde {session_record.last_activity})")
                
                except Exception as e:
                    logger.error(f"❌ Erro ao analisar sessão inativa {session_id}: {e}")
            
            if analyzed_count > 0:
                logger.info(f"⏰ Total de análises por timeout disparadas: {analyzed_count}")
                
        except Exception as e:
            logger.error(f"❌ Erro ao verificar sessões inativas: {e}")
        finally:
            db.close()
    
    # ===============================
    # UTILITÁRIOS
    # ===============================
    
    def _extract_topics(self, text: str) -> List[str]:
        """Extrair tópicos usando regex simples"""
        # Lista de tópicos técnicos comuns
        topic_patterns = {
            'freios': r'\b(?:freio|freios|frenagem|pastilha|disco|tambor)\b',
            'motor': r'\b(?:motor|motores|arranque|partida|combustão)\b',
            'hidráulico': r'\b(?:hidráulico|hidráulica|óleo|fluido|pressão)\b',
            'elétrico': r'\b(?:elétrico|elétrica|bateria|alternador|fiação)\b',
            'pneu': r'\b(?:pneu|pneus|roda|rodas|pressão|calibragem)\b',
            'manutenção': r'\b(?:manutenção|manutenções|preventiva|corretiva|revisão)\b',
            'peças': r'\b(?:peça|peças|componente|componentes|reposição)\b',
            'problema': r'\b(?:problema|problemas|defeito|defeitos|falha|falhas)\b',
            'configuração': r'\b(?:configuração|configurar|ajuste|calibração)\b'
        }
        
        topics = []
        text_lower = text.lower()
        
        for topic, pattern in topic_patterns.items():
            if re.search(pattern, text_lower):
                topics.append(topic)
        
        return topics
    
    def _extract_keywords(self, text: str) -> List[str]:
        """Extrair palavras-chave relevantes"""
        # Remover stop words e extrair palavras significativas
        stop_words = {'a', 'o', 'e', 'de', 'da', 'do', 'em', 'um', 'uma', 'para', 'com', 'não', 'que', 'se', 'por'}
        
        words = re.findall(r'\b\w{3,}\b', text.lower())
        keywords = [word for word in words if word not in stop_words]
        
        # Retornar top 10 palavras mais frequentes
        from collections import Counter
        return [word for word, count in Counter(keywords).most_common(10)]
    
    def estimate_tokens(self, text: str) -> int:
        """Estimar tokens baseado no texto (método simples)"""
        if not text:
            return 0
        
        # Estimativa: ~4 caracteres = 1 token
        return len(text) // 4
    
    def calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """Calcular custo estimado baseado no modelo"""
        # Preços aproximados por 1M tokens (2025)
        pricing = {
            'gpt-5': {'input': 15.0, 'output': 60.0},
            'gpt-5-mini': {'input': 2.0, 'output': 8.0},
            'gpt-4.1': {'input': 10.0, 'output': 30.0},
            'gpt-4o': {'input': 5.0, 'output': 15.0},
            'gpt-4o-mini': {'input': 0.15, 'output': 0.60},
            'claude-opus-4.1': {'input': 15.0, 'output': 75.0},
            'claude-sonnet-4': {'input': 3.0, 'output': 15.0},
            'claude-sonnet-3.7': {'input': 3.0, 'output': 15.0},
            'claude-3.5-sonnet': {'input': 3.0, 'output': 15.0}
        }
        
        model_pricing = pricing.get(model, {'input': 1.0, 'output': 3.0})
        
        input_cost = (input_tokens / 1_000_000) * model_pricing['input']
        output_cost = (output_tokens / 1_000_000) * model_pricing['output']
        
        return input_cost + output_cost
    
    # ===============================
    # APIs PÚBLICAS
    # ===============================
    
    async def get_active_sessions_count(self) -> int:
        """Obter número de sessões ativas"""
        return len(self.active_sessions)
    
    async def get_real_time_metrics(self) -> Dict[str, Any]:
        """Obter métricas em tempo real"""
        try:
            return {
                'active_sessions': len(self.active_sessions),
                'active_users': len(set(s['user_id'] for s in self.active_sessions.values())),
                'queue_sizes': {
                    'execution': await self.redis_client.llen(self.EXECUTION_QUEUE),
                    'content': await self.redis_client.llen(self.CONTENT_QUEUE),
                    'session': await self.redis_client.llen(self.SESSION_QUEUE),
                    'classification': await self.redis_client.llen(self.CLASSIFICATION_QUEUE)
                },
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"❌ Erro ao obter métricas em tempo real: {e}")
            return {}
    
    # ===============================
    # FALLBACK PARA SALVAMENTO DIRETO (SEM REDIS)
    # ===============================
    
    async def _save_execution_to_db(self, data: Dict[str, Any]):
        """Salvar métricas de execução diretamente no banco (fallback)"""
        from database import SessionLocal
        
        db = SessionLocal()
        try:
            # Processar dados como no worker
            if not data.get('input_tokens') and data.get('input_text'):
                data['input_tokens'] = self.estimate_tokens(data['input_text'])
            if not data.get('output_tokens') and data.get('output_text'):
                data['output_tokens'] = self.estimate_tokens(data['output_text'])
            if not data.get('cost_estimate'):
                data['cost_estimate'] = self.calculate_cost(
                    data.get('model', 'gpt-4o-mini'),
                    data.get('input_tokens', 0),
                    data.get('output_tokens', 0)
                )
            
            # Salvar token usage
            db.execute(text("""
                INSERT INTO token_usage (
                    agent_id, session_id, model_used, input_tokens, 
                    output_tokens, cost_estimate, operation_type, created_at
                ) VALUES (
                    :agent_id, :session_id, :model, :input_tokens,
                    :output_tokens, :cost, :operation_type, :timestamp
                )
            """), {
                'agent_id': data.get('agent_id'),
                'session_id': data.get('session_id'),
                'model': data.get('model', 'gpt-4o-mini'),
                'input_tokens': data.get('input_tokens', 0),
                'output_tokens': data.get('output_tokens', 0),
                'cost': data.get('cost_estimate', 0.0),
                'operation_type': data.get('operation_type', 'chat'),
                'timestamp': datetime.now()
            })
            
            # NOVO: Salvar na tabela agent_executions para cálculo de tempo médio
            db.execute(text("""
                INSERT INTO agent_executions (
                    agent_id, input_text, output_text, tools_used, 
                    execution_time_ms, tokens_used, created_at
                ) VALUES (
                    :agent_id, :input_text, :output_text, :tools_used,
                    :execution_time_ms, :tokens_used, :timestamp
                )
            """), {
                'agent_id': data.get('agent_id'),
                'input_text': data.get('input_text', '')[:1000],  # Limitar tamanho
                'output_text': data.get('output_text', '')[:2000],  # Limitar tamanho
                'tools_used': str(data.get('tools_used', [])),
                'execution_time_ms': data.get('execution_time', data.get('execution_time_ms', 0)),
                'tokens_used': data.get('input_tokens', 0) + data.get('output_tokens', 0),
                'timestamp': datetime.now()
            })
            
            db.commit()
            logger.debug(f"💾 Métrica de execução salva diretamente no banco")
            
        except Exception as e:
            logger.error(f"❌ Erro ao salvar métrica de execução no banco: {e}")
            db.rollback()
        finally:
            db.close()
    
    async def _save_content_to_db(self, data: Dict[str, Any]):
        """Salvar métricas de conteúdo diretamente no banco (fallback)"""
        from database import SessionLocal
        
        db = SessionLocal()
        try:
            content = data.get('message_content', '')
            topics = self._extract_topics(content)
            keywords = self._extract_keywords(content)
            
            if topics:
                import json as json_lib
                db.execute(text("""
                    INSERT INTO content_topics (
                        session_id, agent_id, extracted_topics, 
                        message_content, topic_keywords, confidence_score, created_at
                    ) VALUES (
                        :session_id, :agent_id, :topics, 
                        :content, :keywords, :confidence, :timestamp
                    )
                """), {
                    'session_id': data.get('session_id'),
                    'agent_id': data.get('agent_id'),
                    'topics': json_lib.dumps(topics),
                    'content': content[:500],
                    'keywords': json_lib.dumps(keywords),
                    'confidence': 0.8,
                    'timestamp': datetime.now()
                })
                
                db.commit()
                logger.debug(f"🏷️ Tópicos salvos diretamente no banco: {topics}")
        
        except Exception as e:
            logger.error(f"❌ Erro ao salvar conteúdo no banco: {e}")
            db.rollback()
        finally:
            db.close()
    
    async def _save_session_to_db(self, data: Dict[str, Any]):
        """Salvar métricas de sessão diretamente no banco (fallback)"""
        from database import SessionLocal
        
        db = SessionLocal()
        try:
            db.execute(text("""
                INSERT INTO user_metrics (
                    user_id, session_id, agent_id, team_id, total_messages,
                    session_duration_seconds, created_at, updated_at
                ) VALUES (
                    :user_id, :session_id, :agent_id, :team_id, :messages,
                    :duration, :timestamp, :timestamp
                ) ON CONFLICT (user_id, session_id)
                DO UPDATE SET
                    total_messages = user_metrics.total_messages + :messages,
                    updated_at = :timestamp
            """), {
                'user_id': data.get('user_id', 'anonymous'),
                'session_id': data.get('session_id'),
                'agent_id': data.get('agent_id'),
                'team_id': data.get('team_id'),
                'messages': data.get('message_count', 1),
                'duration': data.get('duration_seconds', 0),
                'timestamp': datetime.now()
            })
            
            db.commit()
            logger.debug(f"👤 Métrica de sessão salva diretamente no banco")
            
        except Exception as e:
            logger.error(f"❌ Erro ao salvar sessão no banco: {e}")
            db.rollback()
        finally:
            db.close()

    # ===============================
    # PERSISTÊNCIA NO BANCO DE DADOS
    # ===============================
    
    def _write_to_db(self, query: str, params: Dict[str, Any]):
        """Escrever dados no banco de forma síncrona"""
        try:
            db = next(get_db())
            db.execute(text(query), params)
            db.commit()
            db.close()
        except Exception as e:
            logger.error(f"❌ Erro ao escrever no banco: {e}")
    
    async def _persist_user_metrics(self, data: Dict[str, Any]):
        """Persistir métricas de usuário"""
        query = """
        INSERT INTO user_metrics (user_id, session_id, agent_id, team_id, total_messages, session_duration_seconds)
        VALUES (:user_id, :session_id, :agent_id, :team_id, :total_messages, :session_duration_seconds)
        ON CONFLICT (user_id, session_id) 
        DO UPDATE SET 
            total_messages = user_metrics.total_messages + :total_messages,
            session_duration_seconds = :session_duration_seconds,
            updated_at = NOW()
        """
        self._write_to_db(query, data)
    
    async def _persist_token_usage(self, data: Dict[str, Any]):
        """Persistir consumo de tokens"""
        query = """
        INSERT INTO token_usage (agent_id, session_id, model_used, input_tokens, output_tokens, cost_estimate, operation_type)
        VALUES (:agent_id, :session_id, :model_used, :input_tokens, :output_tokens, :cost_estimate, :operation_type)
        """
        self._write_to_db(query, data)
    
    async def _persist_content_topics(self, data: Dict[str, Any]):
        """Persistir análise de conteúdo"""
        query = """
        INSERT INTO content_topics (session_id, agent_id, extracted_topics, message_content, topic_keywords, confidence_score)
        VALUES (:session_id, :agent_id, :extracted_topics, :message_content, :topic_keywords, :confidence_score)
        """
        self._write_to_db(query, data)


# ===============================
# INSTÂNCIA GLOBAL
# ===============================

# Instância global do coletor
metrics_collector = MetricsCollector()

# Funções de conveniência para usar em outros módulos
async def init_metrics_system():
    """Inicializar sistema de métricas"""
    success = await metrics_collector.initialize()
    if success:
        # Não iniciar workers aqui - será feito no startup do FastAPI
        logger.info("✅ Sistema de métricas inicializado")
    return success

async def collect_agent_execution(agent_id: int, session_id: str, 
                                input_text: str, output_text: str,
                                execution_time_ms: int, model: str):
    """Coletar métricas de execução de agente"""
    input_tokens = metrics_collector.estimate_tokens(input_text)
    output_tokens = metrics_collector.estimate_tokens(output_text)
    cost = metrics_collector.calculate_cost(model, input_tokens, output_tokens)
    
    await metrics_collector.collect_execution_metrics({
        'agent_id': agent_id,
        'session_id': session_id,
        'input_tokens': input_tokens,
        'output_tokens': output_tokens,
        'cost_estimate': cost,
        'execution_time_ms': execution_time_ms,
        'model': model,
        'operation_type': 'chat',
        'timestamp': datetime.now().isoformat()
    })

async def collect_chat_session(session_id: str, user_id: str, 
                              agent_id: Optional[int] = None,
                              team_id: Optional[int] = None,
                              message_count: int = 1):
    """Coletar métricas de sessão de chat"""
    await metrics_collector.collect_session_metrics({
        'session_id': session_id,
        'user_id': user_id,
        'agent_id': agent_id,
        'team_id': team_id,
        'message_count': message_count,
        'timestamp': datetime.now().isoformat()
    })

async def collect_message_content(session_id: str, message_content: str,
                                agent_id: Optional[int] = None):
    """Coletar conteúdo de mensagem para análise"""
    await metrics_collector.collect_content_metrics({
        'session_id': session_id,
        'agent_id': agent_id,
        'message_content': message_content,
        'timestamp': datetime.now().isoformat()
    })

async def request_conversation_analysis(session_id: str, messages: List[Dict]):
    """Solicitar análise inteligente de conversa"""
    conversation_data = {
        'session_id': session_id,
        'messages': messages,
        'user_id': messages[0].get('user_id', 'anonymous') if messages else 'anonymous',
        'agent_id': messages[-1].get('agent_id') if messages else None
    }
    
    await metrics_collector.request_conversation_classification(session_id, conversation_data)

def sync_request_conversation_analysis(session_id: str, messages: List[Dict]):
    """Versão síncrona para análise de conversa (para uso em threads)"""
    try:
        import asyncio
        conversation_data = {
            'session_id': session_id,
            'messages': messages,
            'user_id': messages[0].get('user_id', 'anonymous') if messages else 'anonymous',
            'agent_id': messages[-1].get('agent_id') if messages else None
        }
        
        # Executar de forma síncrona
        asyncio.run(metrics_collector.request_conversation_classification(session_id, conversation_data))
        
    except Exception as e:
        logger.error(f"❌ Erro na análise síncrona: {e}")
        
        # Fallback direto no banco
        try:
            from database import SessionLocal
            from sqlalchemy import text
            
            db = SessionLocal()
            db.execute(text("""
                INSERT INTO user_feedback (
                    session_id, user_id, agent_id, rating, 
                    issue_category, feedback_comment, sentiment, auto_generated, created_at
                ) VALUES (
                    :session_id, :user_id, :agent_id, :rating,
                    :category, :comment, :sentiment, :auto_generated, NOW()
                )
            """), {
                'session_id': session_id,
                'user_id': conversation_data.get('user_id', 'sync_analysis'),
                'agent_id': conversation_data.get('agent_id'),
                'rating': 3,  # Rating neutro para análises automáticas
                'category': 'auto_analysis',
                'comment': f'Análise automática - {len(messages)} mensagens processadas',
                'sentiment': 'neutro',
                'auto_generated': True
            })
            db.commit()
            db.close()
            logger.info(f"✅ Análise síncrona salva como fallback: {session_id}")
        except Exception as fallback_error:
            logger.error(f"❌ Erro no fallback síncrono: {fallback_error}")