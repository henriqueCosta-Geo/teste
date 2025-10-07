"""
Endpoints para Dashboard de Administração
Data Enriching: MongoDB (NoSQL) + PostgreSQL (SQL)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import logging

from database import get_db
from mongo_service import get_mongo_service
from mongo_chat_service import MongoChatService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ============================================================================
# SCHEMAS
# ============================================================================

class OverviewMetrics(BaseModel):
    customer_id: int
    customer_name: str
    plan_type: str
    total_users: int
    active_users: int
    total_chats: int
    total_messages: int
    period_days: int

class TokenConsumption(BaseModel):
    total_tokens: int
    input_tokens: int
    output_tokens: int
    by_model: Dict[str, Any]
    by_agent: List[Dict[str, Any]]
    estimated_cost: float

class AgentPerformance(BaseModel):
    agent_id: int
    agent_name: str
    agent_model: str
    team_name: Optional[str]
    total_messages: int
    avg_execution_time_ms: float
    success_rate: float
    errors: int
    rag_usage_rate: float
    avg_chunks_per_query: float
    collections_count: int

class ConversationInsights(BaseModel):
    total_chats: int
    avg_messages_per_chat: float
    users_activity: List[Dict[str, Any]]
    top_teams: List[Dict[str, Any]]

class RAGAnalytics(BaseModel):
    total_rag_queries: int
    rag_usage_rate: float
    top_sources: List[Dict[str, Any]]
    avg_similarity_score: float
    collections_stats: List[Dict[str, Any]]

class QualityMetrics(BaseModel):
    total_messages: int
    successful_messages: int
    failed_messages: int
    success_rate: float
    errors: List[Dict[str, Any]]
    slow_queries: List[Dict[str, Any]]

class DashboardResponse(BaseModel):
    overview: OverviewMetrics
    token_consumption: TokenConsumption
    agents_performance: List[AgentPerformance]
    conversation_insights: ConversationInsights
    rag_analytics: RAGAnalytics
    quality_metrics: QualityMetrics
    generated_at: str

# ============================================================================
# HELPER FUNCTIONS - MongoDB Aggregations
# ============================================================================

async def aggregate_overview_metrics(
    mongo_chat_service: MongoChatService,
    customer_id: int,
    start_date: datetime,
    end_date: datetime
) -> Dict[str, Any]:
    """Agregar métricas gerais do MongoDB"""
    try:
        chats = await mongo_chat_service.get_customer_chats(
            customer_id=customer_id,
            limit=10000
        )

        # Filtrar por período
        filtered_chats = [
            chat for chat in chats
            if start_date <= chat.get('created_at', datetime.min) <= end_date
        ]

        total_chats = len(filtered_chats)
        total_messages = sum(len(chat.get('mensagens', [])) for chat in filtered_chats)

        return {
            'total_chats': total_chats,
            'total_messages': total_messages
        }
    except Exception as e:
        logger.error(f"Erro ao agregar overview: {e}")
        return {'total_chats': 0, 'total_messages': 0}

async def aggregate_token_consumption(
    mongo_chat_service: MongoChatService,
    customer_id: int,
    start_date: datetime,
    end_date: datetime,
    db: Session
) -> Dict[str, Any]:
    """Agregar consumo de tokens do MongoDB"""
    try:
        chats = await mongo_chat_service.get_customer_chats(
            customer_id=customer_id,
            limit=10000
        )

        total_tokens = 0
        input_tokens = 0
        output_tokens = 0
        by_model = {}
        by_agent = {}

        for chat in chats:
            if not (start_date <= chat.get('created_at', datetime.min) <= end_date):
                continue

            for msg in chat.get('mensagens', []):
                msg_date = msg.get('created_at')
                if not msg_date or not (start_date <= msg_date <= end_date):
                    continue

                # Tokens totais
                token_total = msg.get('token_total', 0)
                tokens = msg.get('tokens', {})
                token_input = tokens.get('input', 0)
                token_output = tokens.get('output', 0)

                total_tokens += token_total
                input_tokens += token_input
                output_tokens += token_output

                # Por modelo
                model = msg.get('model_used', 'unknown')
                if model not in by_model:
                    by_model[model] = {'tokens': 0, 'messages': 0}
                by_model[model]['tokens'] += token_total
                by_model[model]['messages'] += 1

                # Por agente
                agent_id = msg.get('user_assistant_id')
                if agent_id and isinstance(agent_id, int):
                    if agent_id not in by_agent:
                        by_agent[agent_id] = {
                            'agent_id': agent_id,
                            'tokens': 0,
                            'messages': 0,
                            'agent_name': msg.get('agent_name', f'agent-{agent_id}'),
                            'team_name': msg.get('team_name')
                        }
                    by_agent[agent_id]['tokens'] += token_total
                    by_agent[agent_id]['messages'] += 1

        # Calcular custo estimado (preços aproximados OpenAI)
        cost = 0.0
        pricing = {
            'gpt-4': {'input': 0.03/1000, 'output': 0.06/1000},
            'gpt-4o': {'input': 0.0025/1000, 'output': 0.01/1000},
            'gpt-4o-mini': {'input': 0.00015/1000, 'output': 0.0006/1000},
            'gpt-3.5-turbo': {'input': 0.0005/1000, 'output': 0.0015/1000}
        }

        for model, data in by_model.items():
            if model in pricing:
                # Aproximação: 70% input, 30% output
                model_input = data['tokens'] * 0.7
                model_output = data['tokens'] * 0.3
                cost += (model_input * pricing[model]['input']) + (model_output * pricing[model]['output'])

        # Adicionar avg_tokens_per_message para cada agente
        for agent_data in by_agent.values():
            if agent_data['messages'] > 0:
                agent_data['avg_tokens_per_message'] = round(agent_data['tokens'] / agent_data['messages'], 2)
            else:
                agent_data['avg_tokens_per_message'] = 0

        # Calcular custo por modelo
        for model, data in by_model.items():
            if model in pricing:
                model_input = data['tokens'] * 0.7
                model_output = data['tokens'] * 0.3
                data['cost'] = round((model_input * pricing[model]['input']) + (model_output * pricing[model]['output']), 2)
            else:
                data['cost'] = 0.0

        return {
            'total_tokens': total_tokens,
            'input_tokens': input_tokens,
            'output_tokens': output_tokens,
            'by_model': by_model,
            'by_agent': sorted(list(by_agent.values()), key=lambda x: x['tokens'], reverse=True),
            'estimated_cost': round(cost, 2)
        }
    except Exception as e:
        logger.error(f"Erro ao agregar tokens: {e}")
        return {
            'total_tokens': 0,
            'input_tokens': 0,
            'output_tokens': 0,
            'by_model': {},
            'by_agent': [],
            'estimated_cost': 0.0
        }

async def aggregate_agent_performance(
    mongo_chat_service: MongoChatService,
    customer_id: int,
    start_date: datetime,
    end_date: datetime,
    db: Session
) -> List[Dict[str, Any]]:
    """Agregar performance de agentes"""
    try:
        from agent_models import Agent, AgentTeam, AgentCollection

        chats = await mongo_chat_service.get_customer_chats(
            customer_id=customer_id,
            limit=10000
        )

        agent_stats = {}

        for chat in chats:
            if not (start_date <= chat.get('created_at', datetime.min) <= end_date):
                continue

            for msg in chat.get('mensagens', []):
                msg_date = msg.get('created_at')
                if not msg_date or not (start_date <= msg_date <= end_date):
                    continue

                if msg.get('message_type') not in ['team', 'agent']:
                    continue

                agent_id = msg.get('user_assistant_id')
                if not agent_id or not isinstance(agent_id, int):
                    continue

                if agent_id not in agent_stats:
                    agent_stats[agent_id] = {
                        'agent_id': agent_id,
                        'total_messages': 0,
                        'execution_times': [],
                        'tokens': 0,
                        'successes': 0,
                        'errors': 0,
                        'rag_queries': 0,
                        'total_chunks': 0,
                        'team_name': msg.get('team_name'),
                        'agent_name': msg.get('agent_name', f'agent-{agent_id}')
                    }

                stats = agent_stats[agent_id]
                stats['total_messages'] += 1

                exec_time = msg.get('execution_time_ms', 0)
                if exec_time > 0:
                    stats['execution_times'].append(exec_time)

                stats['tokens'] += msg.get('token_total', 0)

                if msg.get('success', True):
                    stats['successes'] += 1
                else:
                    stats['errors'] += 1

                if msg.get('rag', False):
                    stats['rag_queries'] += 1
                    stats['total_chunks'] += msg.get('rag_chunks_count', 0)

        # Enriquecer com dados SQL
        result = []
        for agent_id, stats in agent_stats.items():
            # Buscar agente sem filtro de customer_id (ainda não implementado)
            agent = db.query(Agent).filter(Agent.id == agent_id).first()

            if not agent:
                continue

            # Contar collections
            collections_count = db.query(AgentCollection).filter(
                AgentCollection.agent_id == agent_id
            ).count()

            # Calcular métricas
            avg_exec_time = sum(stats['execution_times']) / len(stats['execution_times']) if stats['execution_times'] else 0
            success_rate = (stats['successes'] / stats['total_messages'] * 100) if stats['total_messages'] > 0 else 0
            rag_usage_rate = (stats['rag_queries'] / stats['total_messages'] * 100) if stats['total_messages'] > 0 else 0
            avg_chunks = stats['total_chunks'] / stats['rag_queries'] if stats['rag_queries'] > 0 else 0

            result.append({
                'agent_id': agent_id,
                'agent_name': agent.name,
                'agent_model': agent.model,
                'team_name': stats['team_name'],
                'total_messages': stats['total_messages'],
                'avg_execution_time_ms': round(avg_exec_time, 2),
                'success_rate': round(success_rate, 2),
                'errors': stats['errors'],
                'rag_usage_rate': round(rag_usage_rate, 2),
                'avg_chunks_per_query': round(avg_chunks, 2),
                'collections_count': collections_count
            })

        return sorted(result, key=lambda x: x['total_messages'], reverse=True)

    except Exception as e:
        logger.error(f"Erro ao agregar performance: {e}")
        return []

async def aggregate_conversation_insights(
    mongo_chat_service: MongoChatService,
    customer_id: int,
    start_date: datetime,
    end_date: datetime,
    db: Session
) -> Dict[str, Any]:
    """Agregar insights de conversas"""
    try:
        from agent_models import AgentTeam

        chats = await mongo_chat_service.get_customer_chats(
            customer_id=customer_id,
            limit=10000
        )

        filtered_chats = [
            chat for chat in chats
            if start_date <= chat.get('created_at', datetime.min) <= end_date
        ]

        total_chats = len(filtered_chats)
        total_messages = sum(len(chat.get('mensagens', [])) for chat in filtered_chats)
        avg_messages_per_chat = total_messages / total_chats if total_chats > 0 else 0

        # Users activity
        user_stats = {}
        team_stats = {}

        for chat in filtered_chats:
            created_by = chat.get('created_by')
            team_id = chat.get('team_id')

            # User stats
            if created_by:
                if created_by not in user_stats:
                    user_stats[created_by] = {
                        'user_id': created_by,
                        'chats_started': 0,
                        'messages_sent': 0,
                        'last_active': None,
                        'teams_used': {}
                    }

                user_stats[created_by]['chats_started'] += 1

                # Count user messages
                user_messages = [msg for msg in chat.get('mensagens', []) if msg.get('message_type') == 'user']
                user_stats[created_by]['messages_sent'] += len(user_messages)

                # Track last active
                if chat.get('created_at'):
                    if not user_stats[created_by]['last_active'] or chat['created_at'] > user_stats[created_by]['last_active']:
                        user_stats[created_by]['last_active'] = chat['created_at']

                # Track teams used
                if team_id:
                    user_stats[created_by]['teams_used'][team_id] = user_stats[created_by]['teams_used'].get(team_id, 0) + 1

            # Team stats
            if team_id:
                if team_id not in team_stats:
                    team_stats[team_id] = {
                        'team_id': team_id,
                        'usage_count': 0,
                        'unique_users': set()
                    }

                team_stats[team_id]['usage_count'] += 1
                if created_by:
                    team_stats[team_id]['unique_users'].add(created_by)

        # Enriquecer users (por enquanto sem dados SQL de users)
        users_activity = []
        for user_id, stats in user_stats.items():
            # Find favorite team
            favorite_team_id = max(stats['teams_used'].items(), key=lambda x: x[1])[0] if stats['teams_used'] else None
            favorite_team_name = None

            if favorite_team_id:
                team = db.query(AgentTeam).filter(AgentTeam.id == favorite_team_id).first()
                if team:
                    favorite_team_name = team.name

            users_activity.append({
                'user_id': user_id,
                'user_name': f'User {user_id}',  # Placeholder até ter modelo User
                'user_email': f'user{user_id}@example.com',  # Placeholder
                'chats_started': stats['chats_started'],
                'messages_sent': stats['messages_sent'],
                'last_active': stats['last_active'].isoformat() if stats['last_active'] else None,
                'favorite_team': favorite_team_name
            })

        # Enriquecer teams com SQL
        top_teams = []
        for team_id, stats in team_stats.items():
            team = db.query(AgentTeam).filter(AgentTeam.id == team_id).first()
            if team:
                top_teams.append({
                    'team_id': team_id,
                    'team_name': team.name,
                    'usage_count': stats['usage_count'],
                    'unique_users': len(stats['unique_users'])
                })

        return {
            'total_chats': total_chats,
            'avg_messages_per_chat': round(avg_messages_per_chat, 2),
            'users_activity': sorted(users_activity, key=lambda x: x['chats_started'], reverse=True),
            'top_teams': sorted(top_teams, key=lambda x: x['usage_count'], reverse=True)
        }

    except Exception as e:
        logger.error(f"Erro ao agregar insights: {e}")
        return {
            'total_chats': 0,
            'avg_messages_per_chat': 0,
            'users_activity': [],
            'top_teams': []
        }

async def aggregate_rag_analytics(
    mongo_chat_service: MongoChatService,
    customer_id: int,
    start_date: datetime,
    end_date: datetime,
    db: Session
) -> Dict[str, Any]:
    """Agregar analytics de RAG"""
    try:
        from models import Collection

        chats = await mongo_chat_service.get_customer_chats(
            customer_id=customer_id,
            limit=10000
        )

        total_queries = 0
        total_rag_queries = 0
        source_stats = {}
        all_scores = []

        for chat in chats:
            if not (start_date <= chat.get('created_at', datetime.min) <= end_date):
                continue

            for msg in chat.get('mensagens', []):
                msg_date = msg.get('created_at')
                if not msg_date or not (start_date <= msg_date <= end_date):
                    continue

                if msg.get('message_type') in ['team', 'agent']:
                    total_queries += 1

                    if msg.get('rag', False):
                        total_rag_queries += 1

                        # Process RAG sources
                        for source in msg.get('rag_sources', []):
                            collection_name = source.get('collection', 'unknown')
                            score = source.get('score', 0)

                            if collection_name not in source_stats:
                                source_stats[collection_name] = {
                                    'collection': collection_name,
                                    'queries': 0,
                                    'scores': [],
                                    'agents_using': set()
                                }

                            source_stats[collection_name]['queries'] += 1
                            source_stats[collection_name]['scores'].append(score)
                            all_scores.append(score)

                            agent_id = msg.get('user_assistant_id')
                            if agent_id:
                                source_stats[collection_name]['agents_using'].add(agent_id)

        # Calculate metrics
        rag_usage_rate = (total_rag_queries / total_queries * 100) if total_queries > 0 else 0
        avg_similarity_score = sum(all_scores) / len(all_scores) if all_scores else 0

        # Top sources
        top_sources = []
        for collection_name, stats in source_stats.items():
            avg_score = sum(stats['scores']) / len(stats['scores']) if stats['scores'] else 0
            top_sources.append({
                'collection': collection_name,
                'queries': stats['queries'],
                'avg_score': round(avg_score, 3),
                'agents_using': list(stats['agents_using'])
            })

        top_sources = sorted(top_sources, key=lambda x: x['queries'], reverse=True)

        # Collections stats (enrich with SQL)
        collections_stats = []
        # Buscar todas collections (customer_id ainda não implementado)
        collections = db.query(Collection).all()

        for collection in collections:
            rag_queries = source_stats.get(collection.name, {}).get('queries', 0)
            avg_chunks = 0  # Seria necessário calcular do MongoDB

            collections_stats.append({
                'collection_id': collection.id,
                'collection_name': collection.name,
                'files_count': len(collection.files) if hasattr(collection, 'files') else 0,
                'chunks_count': len(collection.chunks) if hasattr(collection, 'chunks') else 0,
                'rag_queries': rag_queries,
                'avg_chunks_per_query': avg_chunks
            })

        return {
            'total_rag_queries': total_rag_queries,
            'rag_usage_rate': round(rag_usage_rate, 2),
            'top_sources': top_sources[:10],
            'avg_similarity_score': round(avg_similarity_score, 3),
            'collections_stats': collections_stats
        }

    except Exception as e:
        logger.error(f"Erro ao agregar RAG analytics: {e}")
        return {
            'total_rag_queries': 0,
            'rag_usage_rate': 0,
            'top_sources': [],
            'avg_similarity_score': 0,
            'collections_stats': []
        }

async def aggregate_quality_metrics(
    mongo_chat_service: MongoChatService,
    customer_id: int,
    start_date: datetime,
    end_date: datetime
) -> Dict[str, Any]:
    """Agregar métricas de qualidade"""
    try:
        chats = await mongo_chat_service.get_customer_chats(
            customer_id=customer_id,
            limit=10000
        )

        total_messages = 0
        successful_messages = 0
        failed_messages = 0
        errors = []
        slow_queries = []

        for chat in chats:
            if not (start_date <= chat.get('created_at', datetime.min) <= end_date):
                continue

            for msg in chat.get('mensagens', []):
                msg_date = msg.get('created_at')
                if not msg_date or not (start_date <= msg_date <= end_date):
                    continue

                if msg.get('message_type') not in ['team', 'agent']:
                    continue

                total_messages += 1

                if msg.get('success', True):
                    successful_messages += 1
                else:
                    failed_messages += 1
                    errors.append({
                        'chat_id': chat.get('chat_id'),
                        'mensagem_id': msg.get('mensagem_id'),
                        'agent_name': msg.get('agent_name'),
                        'error': msg.get('error'),
                        'created_at': msg_date.isoformat(),
                        'execution_time_ms': msg.get('execution_time_ms', 0)
                    })

                # Detect slow queries (> 15 seconds)
                exec_time = msg.get('execution_time_ms', 0)
                if exec_time > 15000:
                    slow_queries.append({
                        'chat_id': chat.get('chat_id'),
                        'mensagem_id': msg.get('mensagem_id'),
                        'agent_name': msg.get('agent_name'),
                        'execution_time_ms': exec_time,
                        'tokens': msg.get('token_total', 0),
                        'rag_used': msg.get('rag', False),
                        'created_at': msg_date.isoformat()
                    })

        success_rate = (successful_messages / total_messages * 100) if total_messages > 0 else 100

        return {
            'total_messages': total_messages,
            'successful_messages': successful_messages,
            'failed_messages': failed_messages,
            'success_rate': round(success_rate, 2),
            'errors': sorted(errors, key=lambda x: x['created_at'], reverse=True)[:20],
            'slow_queries': sorted(slow_queries, key=lambda x: x['execution_time_ms'], reverse=True)[:20]
        }

    except Exception as e:
        logger.error(f"Erro ao agregar quality metrics: {e}")
        return {
            'total_messages': 0,
            'successful_messages': 0,
            'failed_messages': 0,
            'success_rate': 100,
            'errors': [],
            'slow_queries': []
        }

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/dashboard/{customer_id}", response_model=DashboardResponse)
async def get_admin_dashboard(
    customer_id: int,
    days_back: int = Query(30, ge=1, le=365, description="Dias para análise"),
    db: Session = Depends(get_db)
):
    """
    Dashboard administrativo com data enriching MongoDB + PostgreSQL

    Combina dados de:
    - MongoDB: métricas de conversas, tokens, performance
    - PostgreSQL: informações de customers, users, agents, teams

    **Nota**: Autenticação será adicionada futuramente
    """
    try:
        # Por enquanto, sem validação de customer (será implementado futuramente)
        # TODO: Adicionar modelo Customer quando sistema multi-tenant estiver completo

        # Date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)

        # Initialize MongoDB service
        mongo_service = get_mongo_service()
        mongo_chat_service = MongoChatService(mongo_service)

        # Get all metrics (parallel aggregations)
        logger.info(f"🔍 Gerando dashboard para customer {customer_id}")

        overview_data = await aggregate_overview_metrics(
            mongo_chat_service, customer_id, start_date, end_date
        )

        token_data = await aggregate_token_consumption(
            mongo_chat_service, customer_id, start_date, end_date, db
        )

        agent_perf = await aggregate_agent_performance(
            mongo_chat_service, customer_id, start_date, end_date, db
        )

        conversation_data = await aggregate_conversation_insights(
            mongo_chat_service, customer_id, start_date, end_date, db
        )

        rag_data = await aggregate_rag_analytics(
            mongo_chat_service, customer_id, start_date, end_date, db
        )

        quality_data = await aggregate_quality_metrics(
            mongo_chat_service, customer_id, start_date, end_date
        )

        # Count users (será implementado quando multi-tenant estiver completo)
        total_users = 0
        active_users = 0

        # Build response
        response = DashboardResponse(
            overview=OverviewMetrics(
                customer_id=customer_id,
                customer_name=f"Customer {customer_id}",  # Placeholder
                plan_type="BASIC",  # Placeholder
                total_users=total_users,
                active_users=active_users,
                total_chats=overview_data['total_chats'],
                total_messages=overview_data['total_messages'],
                period_days=days_back
            ),
            token_consumption=TokenConsumption(**token_data),
            agents_performance=[AgentPerformance(**perf) for perf in agent_perf],
            conversation_insights=ConversationInsights(**conversation_data),
            rag_analytics=RAGAnalytics(**rag_data),
            quality_metrics=QualityMetrics(**quality_data),
            generated_at=datetime.now().isoformat()
        )

        logger.info(f"✅ Dashboard gerado com sucesso para customer {customer_id}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao gerar dashboard: {e}")
        logger.exception(e)
        raise HTTPException(status_code=500, detail="Erro ao gerar dashboard")
