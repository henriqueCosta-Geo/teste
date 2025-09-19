from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, text, desc, and_, or_
from agent_models import (
    Agent, AgentExecution, ChatSession, ChatMessage, 
    AgentTeam, TeamMember, AgentCollection,
    TokenUsage, UserMetrics, PerformanceMetrics, 
    ContentTopics, UserFeedback
)
import logging

logger = logging.getLogger(__name__)

class AnalyticsService:
    """Serviço para analytics e métricas do sistema"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_user_metrics(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        agent_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Obter métricas de usuários com dados reais"""
        
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()
            
        # Query base para filtrar por período
        base_query = self.db.query(ChatSession).filter(
            ChatSession.created_at >= start_date,
            ChatSession.created_at <= end_date + timedelta(days=1)
        )
        
        if agent_id:
            base_query = base_query.filter(
                or_(ChatSession.agent_id == agent_id, 
                    ChatSession.team_id.in_(
                        self.db.query(AgentTeam.id).filter(AgentTeam.leader_agent_id == agent_id)
                    ))
            )
        
        # Calcular métricas
        total_sessions = base_query.count()
        
        # Usuários únicos (assumindo session_id contém info do usuário)
        unique_users = self.db.query(func.count(func.distinct(ChatSession.session_id))).filter(
            ChatSession.created_at >= start_date,
            ChatSession.created_at <= end_date + timedelta(days=1)
        ).scalar() or 0
        
        # Sessões ativas agora (últimas 5 minutos)
        current_active = self.db.query(func.count(ChatSession.id)).filter(
            ChatSession.last_activity > datetime.now() - timedelta(minutes=5)
        ).scalar() or 0
        
        # Tempo médio de resposta dos agentes (dos últimos 30 dias)
        # Como não temos AgentExecution populada, vamos usar uma estimativa baseada em PerformanceMetrics
        # ou mostrar 0 se não houver dados reais
        avg_response_time = self.db.query(func.avg(PerformanceMetrics.avg_response_time_ms)).filter(
            PerformanceMetrics.created_at >= datetime.now() - timedelta(days=30)
        ).scalar()
        
        # Se não há dados em PerformanceMetrics, tentar AgentExecution como fallback
        if not avg_response_time:
            avg_response_time = self.db.query(func.avg(AgentExecution.execution_time_ms)).filter(
                AgentExecution.created_at >= datetime.now() - timedelta(days=30)
            ).scalar()
        
        avg_response_time = avg_response_time or 0
        
        # Total de mensagens no período
        total_messages = self.db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.created_at >= start_date,
            ChatMessage.created_at <= end_date + timedelta(days=1)
        ).scalar() or 0
        
        # Média de mensagens por chat
        avg_messages_per_chat = (total_messages / total_sessions) if total_sessions > 0 else 0
        
        # Picos de usuários simultâneos (simulado baseado em atividade)
        max_concurrent = self.db.query(
            func.count(func.distinct(ChatSession.session_id))
        ).filter(
            ChatSession.created_at >= start_date - timedelta(days=1),
            ChatSession.last_activity >= start_date - timedelta(days=1)
        ).scalar() or 0
        
        return {
            "total_users": unique_users,
            "total_sessions": total_sessions,
            "current_active_users": current_active,
            "max_concurrent_users": max_concurrent,
            "average_response_time_seconds": round((avg_response_time / 1000) if avg_response_time else 0, 2),
            "total_messages": total_messages,
            "average_messages_per_chat": round(avg_messages_per_chat, 1),
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat()
        }
    
    def get_token_metrics(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Métricas de consumo de tokens - USANDO DADOS REAIS"""
        
        if not start_date:
            start_date = date.today().replace(day=1)  # Início do mês
        if not end_date:
            end_date = date.today()
        
        # DADOS REAIS da tabela TokenUsage
        token_records = self.db.query(TokenUsage).filter(
            TokenUsage.created_at >= start_date,
            TokenUsage.created_at <= end_date + timedelta(days=1)
        ).all()
        
        # Calcular métricas reais
        total_input_tokens = sum(record.input_tokens or 0 for record in token_records)
        total_output_tokens = sum(record.output_tokens or 0 for record in token_records)
        total_tokens = total_input_tokens + total_output_tokens
        total_cost = sum(record.cost_estimate or 0.0 for record in token_records)
        
        # Agrupar por modelo
        tokens_by_model = {}
        for record in token_records:
            model = record.model_used or "unknown"
            if model not in tokens_by_model:
                tokens_by_model[model] = {
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                    "cost": 0.0
                }
            
            tokens_by_model[model]["input_tokens"] += record.input_tokens or 0
            tokens_by_model[model]["output_tokens"] += record.output_tokens or 0
            tokens_by_model[model]["total_tokens"] += (record.input_tokens or 0) + (record.output_tokens or 0)
            tokens_by_model[model]["cost"] += record.cost_estimate or 0.0
        
        # Calcular projeções
        days_elapsed = (end_date - start_date).days + 1
        days_in_month = 31
        daily_average = total_tokens / days_elapsed if days_elapsed > 0 else 0
        estimated_monthly = daily_average * days_in_month
        
        # Limite mensal (configurável)
        monthly_limit = 10_000_000  # 10M tokens/mês
        remaining_tokens = max(0, monthly_limit - int(estimated_monthly))
        
        return {
            "monthly_consumption": int(total_tokens),
            "daily_average": int(daily_average),
            "estimated_end_month": int(estimated_monthly),
            "remaining_tokens": int(remaining_tokens),
            "monthly_limit": monthly_limit,
            "consumption_by_model": tokens_by_model,
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "will_exceed_limit": estimated_monthly > monthly_limit
        }
    
    def get_trending_topics(
        self,
        limit: int = 10,
        days_back: int = 7
    ) -> List[Dict[str, Any]]:
        """Obter tópicos em alta - USANDO DADOS REAIS"""
        
        cutoff_date = datetime.now() - timedelta(days=days_back)
        
        # DADOS REAIS da tabela ContentTopics
        topic_records = self.db.query(ContentTopics).filter(
            ContentTopics.created_at >= cutoff_date
        ).all()
        
        # Contar ocorrências de tópicos com filtros melhorados
        topic_counts = {}
        session_counts = {}
        machine_models = {}  # Contador específico para modelos de máquinas
        
        for record in topic_records:
            import json
            try:
                topics = json.loads(record.extracted_topics) if isinstance(record.extracted_topics, str) else record.extracted_topics
                if isinstance(topics, list):
                    for topic in topics:
                        # Filtrar tópicos genéricos demais
                        if self._should_ignore_topic(topic):
                            continue
                        
                        # Consolidar tópicos similares
                        normalized_topic = self._normalize_topic(topic)
                        
                        # Verificar se é modelo de máquina
                        if self._is_machine_model(normalized_topic):
                            if normalized_topic not in machine_models:
                                machine_models[normalized_topic] = 0
                            machine_models[normalized_topic] += 1
                        
                        if normalized_topic not in topic_counts:
                            topic_counts[normalized_topic] = 0
                            session_counts[normalized_topic] = set()
                        topic_counts[normalized_topic] += 1
                        session_counts[normalized_topic].add(record.session_id)
            except (json.JSONDecodeError, TypeError):
                continue
        
        # Converter para lista ordenada
        trending_topics = []
        for topic, count in sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:limit * 2]:  # Pegar mais para filtrar depois
            unique_sessions = len(session_counts[topic])
            
            # Calcular score de tendência (ocorrências * sessões únicas)
            trend_score = count * unique_sessions
            
            category = self._categorize_topic(topic)
            
            trending_topics.append({
                "name": topic,
                "mentions": count,
                "unique_sessions": unique_sessions,
                "trend_score": trend_score,
                "category": category,
                "is_machine_model": self._is_machine_model(topic)
            })
        
        # Filtrar e limitar
        filtered_topics = [t for t in trending_topics if t['mentions'] >= 1]
        return filtered_topics[:limit]
    
    def _categorize_topic(self, topic: str) -> str:
        """Categorizar um tópico automaticamente"""
        topic_lower = topic.lower()
        
        # Categorias baseadas em palavras-chave
        if any(word in topic_lower for word in ['freio', 'freios', 'pastilha', 'disco', 'tambor']):
            return 'freios'
        elif any(word in topic_lower for word in ['motor', 'motores', 'partida', 'combustão']):
            return 'motor'
        elif any(word in topic_lower for word in ['hidráulico', 'hidráulica', 'óleo', 'pressão']):
            return 'hidráulico'
        elif any(word in topic_lower for word in ['elétrico', 'elétrica', 'bateria', 'alternador']):
            return 'elétrico'
        elif any(word in topic_lower for word in ['pneu', 'pneus', 'roda', 'rodas']):
            return 'pneus'
        elif any(word in topic_lower for word in ['a8000', 'a8800', 'a9000', 'ch570', 'ch670', 'ch950']):
            return 'modelos'
        elif any(word in topic_lower for word in ['problema', 'defeito', 'falha']):
            return 'problemas'
        else:
            return 'geral'
    
    def _should_ignore_topic(self, topic: str) -> bool:
        """Verificar se o tópico deve ser ignorado (muito genérico)"""
        topic_lower = topic.lower().strip()
        
        # Tópicos genéricos demais para ignorar
        ignored_topics = {
            'problema', 'problemas', 'defeito', 'defeitos', 'falha', 'falhas',
            'diagnóstico', 'diagnóstico de problemas', 'problema no', 'problema nos',
            'erro', 'erros', 'dificuldade', 'dificuldades', 'questão', 'questões'
        }
        
        # Ignorar se for muito genérico
        if topic_lower in ignored_topics:
            return True
        
        # Ignorar se for muito curto (menos de 3 caracteres)
        if len(topic_lower) < 3:
            return True
        
        # Ignorar se for apenas um número
        if topic_lower.isdigit():
            return True
        
        return False
    
    def _normalize_topic(self, topic: str) -> str:
        """Normalizar e consolidar tópicos similares"""
        topic_lower = topic.lower().strip()
        
        # Consolidar variações de freios
        if any(word in topic_lower for word in ['freio', 'freios']):
            if 'pastilha' in topic_lower or 'pastilhas' in topic_lower:
                return 'pastilhas de freio'
            elif 'disco' in topic_lower or 'discos' in topic_lower:
                return 'discos de freio'
            else:
                return 'sistema de freios'
        
        # Consolidar modelos de máquinas
        machine_patterns = {
            'a8000': 'Case IH Austoft A8000',
            'a8800': 'Case IH Austoft A8800',
            'a8810': 'Case IH Austoft A8810',
            'a9000': 'Case IH Austoft A9000',
            'a9900': 'Case IH Austoft A9900',
            'ch570': 'New Holland CH570',
            'ch670': 'New Holland CH670',
            'ch950': 'New Holland CH950'
        }
        
        for pattern, normalized in machine_patterns.items():
            if pattern in topic_lower:
                return normalized
        
        # Consolidar "colhedora de cana" com modelos
        if 'colhedora' in topic_lower and ('case' in topic_lower or 'austoft' in topic_lower):
            if 'a8000' in topic_lower:
                return 'Case IH Austoft A8000'
            elif 'a8800' in topic_lower:
                return 'Case IH Austoft A8800'
            elif 'a8810' in topic_lower:
                return 'Case IH Austoft A8810'
            elif 'a9000' in topic_lower:
                return 'Case IH Austoft A9000'
            elif 'a9900' in topic_lower:
                return 'Case IH Austoft A9900'
            else:
                return 'colhedora Case IH'
        
        return topic.strip()
    
    def _is_machine_model(self, topic: str) -> bool:
        """Verificar se o tópico é um modelo de máquina"""
        topic_lower = topic.lower()
        
        machine_indicators = [
            'a8000', 'a8800', 'a8810', 'a9000', 'a9900', 'ch570', 'ch670', 'ch950',
            'case ih', 'new holland', 'austoft', 'colhedora'
        ]
        
        return any(indicator in topic_lower for indicator in machine_indicators)
    
    def get_machine_references(self, days_back: int = 30) -> Dict[str, Any]:
        """Obter contador de referências por máquina/modelo"""
        
        cutoff_date = datetime.now() - timedelta(days=days_back)
        
        # DADOS REAIS da tabela ContentTopics
        topic_records = self.db.query(ContentTopics).filter(
            ContentTopics.created_at >= cutoff_date
        ).all()
        
        machine_counts = {}
        
        for record in topic_records:
            import json
            try:
                topics = json.loads(record.extracted_topics) if isinstance(record.extracted_topics, str) else record.extracted_topics
                if isinstance(topics, list):
                    for topic in topics:
                        # Normalizar tópico
                        normalized_topic = self._normalize_topic(topic)
                        
                        # Verificar se é modelo de máquina
                        if self._is_machine_model(normalized_topic):
                            if normalized_topic not in machine_counts:
                                machine_counts[normalized_topic] = 0
                            machine_counts[normalized_topic] += 1
            except (json.JSONDecodeError, TypeError):
                continue
        
        # Converter para lista ordenada
        machine_references = []
        for machine, count in sorted(machine_counts.items(), key=lambda x: x[1], reverse=True):
            machine_references.append({
                "machine_model": machine,
                "references": count,
                "category": "máquinas"
            })
        
        return {
            "machines": machine_references,
            "total_references": sum(machine_counts.values()),
            "unique_machines": len(machine_counts),
            "period_days": days_back
        }
    
    def get_feedback_metrics(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Métricas de feedback e satisfação - USANDO DADOS REAIS"""
        
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()
        
        # DADOS REAIS da tabela UserFeedback
        feedback_records = self.db.query(UserFeedback).filter(
            UserFeedback.created_at >= start_date,
            UserFeedback.created_at <= end_date + timedelta(days=1)
        ).all()
        
        if not feedback_records:
            return {
                "total_feedback": 0,
                "average_rating": 0.0,
                "satisfaction_score": 0,
                "positive_feedback": 0,
                "negative_feedback": 0,
                "neutral_feedback": 0,
                "by_category": {},
                "by_sentiment": {"positivo": 0, "negativo": 0, "neutro": 0},
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat()
            }
        
        # Calcular métricas reais
        ratings = [record.rating for record in feedback_records if record.rating]
        average_rating = sum(ratings) / len(ratings) if ratings else 0.0
        
        # Contar por sentimento
        sentiment_counts = {"positivo": 0, "negativo": 0, "neutro": 0}
        for record in feedback_records:
            sentiment = record.sentiment or "neutro"
            if sentiment in sentiment_counts:
                sentiment_counts[sentiment] += 1
        
        # Contar por categoria
        category_counts = {}
        for record in feedback_records:
            category = record.issue_category or "geral"
            category_counts[category] = category_counts.get(category, 0) + 1
        
        # Score de satisfação (% de feedback positivo)
        total_feedback = len(feedback_records)
        positive_feedback = sentiment_counts["positivo"]
        satisfaction_score = (positive_feedback / total_feedback * 100) if total_feedback > 0 else 0
        
        return {
            "total_feedback": total_feedback,
            "average_rating": round(average_rating, 2),
            "satisfaction_score": round(satisfaction_score, 1),
            "satisfaction_rate": round(satisfaction_score, 1),  # Alias para o dashboard
            "positive_feedback_rate": round(satisfaction_score, 1),  # Alias para o dashboard
            "positive_feedback": sentiment_counts["positivo"],
            "negative_feedback": sentiment_counts["negativo"],
            "neutral_feedback": sentiment_counts["neutro"],
            "by_category": category_counts,
            "by_sentiment": sentiment_counts,
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat()
        }
    
    def get_agent_performance(
        self,
        agent_id: Optional[int] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Performance individual dos agentes - USANDO DADOS REAIS"""
        
        query = self.db.query(Agent)
        if agent_id:
            query = query.filter(Agent.id == agent_id)
        
        agents = query.filter(Agent.is_active == True).limit(limit).all()
        
        performance_data = []
        
        for agent in agents:
            # DADOS REAIS das tabelas PerformanceMetrics e TokenUsage
            # Performance metrics dos últimos 30 dias
            perf_metrics = self.db.query(PerformanceMetrics).filter(
                PerformanceMetrics.agent_id == agent.id,
                PerformanceMetrics.metric_date >= datetime.now().date() - timedelta(days=30)
            ).all()
            
            # Token usage dos últimos 30 dias
            token_records = self.db.query(TokenUsage).filter(
                TokenUsage.agent_id == agent.id,
                TokenUsage.created_at >= datetime.now() - timedelta(days=30)
            ).all()
            
            if not perf_metrics and not token_records:
                continue
            
            # Calcular métricas agregadas
            total_interactions = sum(pm.total_interactions for pm in perf_metrics)
            avg_response_time = sum(pm.avg_response_time_ms for pm in perf_metrics) / len(perf_metrics) if perf_metrics else 0
            tokens_consumed = sum(pm.tokens_consumed for pm in perf_metrics)
            avg_success_rate = sum(pm.success_rate for pm in perf_metrics) / len(perf_metrics) if perf_metrics else 95.0
            
            # Total de tokens dos registros detalhados
            total_input_tokens = sum(tr.input_tokens or 0 for tr in token_records)
            total_output_tokens = sum(tr.output_tokens or 0 for tr in token_records)
            total_cost = sum(tr.cost_estimate or 0.0 for tr in token_records)
            
            # Coleções associadas
            collections_count = self.db.query(func.count(AgentCollection.collection_id)).filter(
                AgentCollection.agent_id == agent.id
            ).scalar() or 0
            
            # Última atividade
            last_activity = None
            if token_records:
                last_activity = max(tr.created_at for tr in token_records).isoformat()
            
            performance_data.append({
                "agent_id": agent.id,
                "agent_name": agent.name,
                "model": agent.model,
                "total_interactions": total_interactions,
                "avg_response_time_ms": round(avg_response_time, 0),
                "tokens_consumed": tokens_consumed,
                "total_input_tokens": total_input_tokens,
                "total_output_tokens": total_output_tokens,
                "total_cost": round(total_cost, 4),
                "collections_count": collections_count,
                "success_rate": round(avg_success_rate, 1),
                "last_active": last_activity
            })
        
        # Ordenar por número de interações
        performance_data.sort(key=lambda x: x["total_interactions"], reverse=True)
        
        return performance_data
    
    def get_system_alerts(self) -> List[Dict[str, Any]]:
        """Gerar alertas do sistema baseado nas métricas"""
        
        alerts = []
        
        # Verificar tokens
        token_metrics = self.get_token_metrics()
        if token_metrics["will_exceed_limit"]:
            alerts.append({
                "type": "warning",
                "severity": "high",
                "message": f"Consumo de tokens pode exceder limite mensal. Estimativa: {token_metrics['estimated_end_month']:,} de {token_metrics['monthly_limit']:,}",
                "category": "tokens",
                "created_at": datetime.now().isoformat()
            })
        
        if token_metrics["remaining_tokens"] < 1_000_000:
            alerts.append({
                "type": "error",
                "severity": "critical",
                "message": f"Tokens restantes baixos: {token_metrics['remaining_tokens']:,}",
                "category": "tokens",
                "created_at": datetime.now().isoformat()
            })
        
        # Verificar performance
        user_metrics = self.get_user_metrics()
        if user_metrics["average_response_time_seconds"] > 15:
            alerts.append({
                "type": "warning",
                "severity": "medium",
                "message": f"Tempo de resposta alto: {user_metrics['average_response_time_seconds']:.1f}s",
                "category": "performance",
                "created_at": datetime.now().isoformat()
            })
        
        # Verificar satisfação
        feedback_metrics = self.get_feedback_metrics()
        if feedback_metrics["satisfaction_score"] < 80:
            alerts.append({
                "type": "warning",
                "severity": "high",
                "message": f"Taxa de satisfação baixa: {feedback_metrics['satisfaction_score']:.1f}%",
                "category": "satisfaction",
                "created_at": datetime.now().isoformat()
            })
        
        return alerts
    
    def get_usage_timeline(
        self,
        days_back: int = 30,
        granularity: str = "day"  # "hour", "day", "week"
    ) -> List[Dict[str, Any]]:
        """Dados de uso ao longo do tempo"""
        
        cutoff_date = datetime.now() - timedelta(days=days_back)
        
        if granularity == "day":
            # Agrupar por dia
            query = self.db.query(
                func.date(ChatSession.created_at).label('period'),
                func.count(ChatSession.id).label('sessions'),
                func.count(func.distinct(ChatSession.session_id)).label('unique_users')
            ).filter(
                ChatSession.created_at >= cutoff_date
            ).group_by(
                func.date(ChatSession.created_at)
            ).order_by('period')
        
        results = query.all()
        
        timeline_data = []
        for result in results:
            timeline_data.append({
                "date": result.period.isoformat(),
                "sessions": result.sessions,
                "unique_users": result.unique_users,
                "period_type": granularity
            })
        
        return timeline_data
    
    def _categorize_topic(self, topic: str) -> str:
        """Categorizar tópico baseado na palavra-chave"""
        
        categories = {
            "manutenção": ["manutenção", "reparo", "substituição", "filtro", "óleo"],
            "problemas_técnicos": ["problema", "erro", "falha", "defeito"],
            "peças": ["peças", "peça", "componente", "motor", "freio", "pneu"],
            "configuração": ["configuração", "instalação", "ajuste", "calibragem"],
            "sistemas": ["hidráulico", "elétrico", "transmissão", "direção"]
        }
        
        topic_lower = topic.lower()
        for category, keywords in categories.items():
            if any(keyword in topic_lower for keyword in keywords):
                return category
        
        return "geral"