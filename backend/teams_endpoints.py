from fastapi import APIRouter, Depends, HTTPException, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import logging
from datetime import datetime
import asyncio
import time

logger = logging.getLogger(__name__)

# Import MetricsCollector for real-time analytics
try:
    from metrics_collector import MetricsCollector
    metrics_collector = MetricsCollector()
except ImportError as e:
    logger.warning(f"MetricsCollector not available: {e}")
    metrics_collector = None

from database import get_db
from agents import AgentManager
from chat_service import ChatService
from agent_models import (
    Agent as AgentModel,
    AgentTeam as AgentTeamModel,
    TeamMember as TeamMemberModel,
    ChatSession,
    ChatMessage
)
from pydantic import BaseModel

# Criar router separado para teams
teams_router = APIRouter(prefix="/api/teams", tags=["teams"])

# ============================================================================
# Cache de AgentManager por session para manter memória do Agno Team
# ============================================================================
from collections import OrderedDict
from typing import Dict

class AgentManagerCache:
    """Cache LRU para AgentManagers por session_id"""
    def __init__(self, max_size: int = 100):
        self.cache: OrderedDict[str, tuple] = OrderedDict()  # session_id -> (agent_manager, last_used)
        self.max_size = max_size

    def get(self, session_id: str, db: Session, qdrant_service):
        """Obtém ou cria AgentManager para uma session"""
        current_time = time.time()

        if session_id in self.cache:
            agent_manager, _ = self.cache[session_id]
            # Atualizar timestamp e mover para o final (mais recente)
            self.cache.move_to_end(session_id)
            self.cache[session_id] = (agent_manager, current_time)
            logger.info(f"♻️ REUTILIZANDO AgentManager para session {session_id}")
            return agent_manager

        # Criar novo AgentManager
        agent_manager = AgentManager(db, qdrant_service)
        self.cache[session_id] = (agent_manager, current_time)
        logger.info(f"🆕 CRIANDO NOVO AgentManager para session {session_id}")

        # Limpar cache se exceder tamanho máximo (remove o mais antigo)
        if len(self.cache) > self.max_size:
            oldest_session = next(iter(self.cache))
            del self.cache[oldest_session]
            logger.info(f"🗑️ Removido AgentManager antigo da session {oldest_session}")

        return agent_manager

    def clear_session(self, session_id: str):
        """Remove AgentManager de uma session específica"""
        if session_id in self.cache:
            del self.cache[session_id]
            logger.info(f"🗑️ AgentManager removido da session {session_id}")

# Instância global do cache
agent_manager_cache = AgentManagerCache(max_size=100)


# ============================================================================
# Funções Auxiliares
# ============================================================================

def count_tokens_for_user_message(text: str, model: str = "gpt-4") -> int:
    """
    Calcula tokens de uma mensagem do usuário usando tiktoken

    Args:
        text: Texto da mensagem
        model: Modelo OpenAI (default: gpt-4)

    Returns:
        Número de tokens (input)
    """
    try:
        import tiktoken

        # Selecionar encoding baseado no modelo
        if "gpt-4" in model:
            encoding = tiktoken.encoding_for_model("gpt-4")
        elif "gpt-3.5" in model:
            encoding = tiktoken.encoding_for_model("gpt-3.5-turbo")
        else:
            # Fallback para cl100k_base (usado por gpt-4 e gpt-3.5-turbo)
            encoding = tiktoken.get_encoding("cl100k_base")

        tokens = len(encoding.encode(text))
        logger.info(f"🔢 [USER-TOKENS] Calculado {tokens} tokens para mensagem de {len(text)} chars")
        return tokens

    except ImportError:
        # Fallback: estimativa aproximada (1 token ≈ 4 caracteres)
        estimated = len(text) // 4
        logger.warning(f"⚠️ tiktoken não disponível - estimando {estimated} tokens")
        return estimated
    except Exception as e:
        logger.error(f"❌ Erro ao calcular tokens: {e}")
        # Fallback: estimativa aproximada
        return len(text) // 4


def build_team_response_metadata(
    result: dict,
    team_id: int,
    team_name: str,
    start_time: float
) -> dict:
    """
    Constrói metadata enriquecido para resposta do time

    Args:
        result: Resultado retornado pelo agent_manager
        team_id: ID do time
        team_name: Nome do time
        start_time: Timestamp do início da execução

    Returns:
        Dict com metadata completo e validado
    """
    # Extrair agents_involved
    agents_involved = result.get('agents_involved', [])

    # Determinar agent_id e agent_name
    agent_id = None
    agent_name = None

    if agents_involved and len(agents_involved) > 0:
        first_agent = agents_involved[0]

        # Checar se é coordenador
        if isinstance(first_agent, str) and 'coordenador' in first_agent.lower():
            agent_id = "Coordenador"
            agent_name = "Coordenador"
        else:
            # Tentar extrair ID de formato "agent-7"
            if isinstance(first_agent, str):
                import re
                match = re.match(r'agent-(\d+)', first_agent, re.IGNORECASE)
                if match:
                    agent_id = int(match.group(1))
                    agent_name = first_agent
                else:
                    agent_id = first_agent
                    agent_name = first_agent
            else:
                agent_id = first_agent
                agent_name = str(first_agent)

    # Extrair e validar tokens - SUPORTAR MÚLTIPLOS FORMATOS
    tokens_raw = result.get('tokens', {})
    logger.info(f"🔢 [METADATA-BUILD] Tokens raw do result: {tokens_raw}")

    # Normalizar tokens
    if isinstance(tokens_raw, dict):
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
        total_tokens = (
            tokens_raw.get('total') or
            tokens_raw.get('total_tokens') or
            (input_tokens + output_tokens)
        )
    else:
        input_tokens = 0
        output_tokens = 0
        total_tokens = 0

    tokens_normalized = {
        'input': int(input_tokens),
        'output': int(output_tokens),
        'total': int(total_tokens)
    }

    logger.info(f"🔢 [METADATA-BUILD] Tokens normalized: {tokens_normalized}")

    # Extrair RAG sources se disponível
    rag_used = result.get('rag_used', False)
    rag_sources = result.get('rag_sources', [])

    # Construir metadata enriquecido
    metadata = {
        # Execution info
        'execution_time_ms': int((time.time() - start_time) * 1000),
        'timestamp': datetime.now().isoformat(),

        # Team info
        'team_id': team_id,
        'team_name': team_name,
        'sender_type': 'team',

        # Agent info
        'agents_involved': agents_involved,
        'agent_id': agent_id,
        'agent_name': agent_name,

        # Tokens (NORMALIZADO)
        'tokens': tokens_normalized,

        # RAG info
        'rag': rag_used,
        'rag_used': rag_used,
        'rag_sources': rag_sources,
        'rag_chunks_count': len(rag_sources) if rag_sources else 0,

        # Model info
        'model': result.get('model', 'unknown'),
        'model_used': result.get('model', 'unknown'),

        # Status
        'success': result.get('success', False),
        'error': result.get('error', None)
    }

    logger.info(f"✅ [METADATA-BUILD] Metadata completo construído")
    logger.info(f"   - Agent: {agent_name} (ID: {agent_id})")
    logger.info(f"   - Tokens: {tokens_normalized}")
    logger.info(f"   - RAG: {rag_used}, chunks: {len(rag_sources) if rag_sources else 0}")
    logger.info(f"   - Model: {metadata['model']}")

    return metadata


# ============================================================================
# Times de Agentes
# ============================================================================

@teams_router.get("/")
def list_teams(db: Session = Depends(get_db)):
    """Listar todos os times de agentes"""
    logger.info("🔍 LISTANDO TIMES...")
    teams = db.query(AgentTeamModel).all()
    logger.info(f"📊 ENCONTRADOS {len(teams)} TIMES NO BANCO")

    result = []
    for team in teams:
        # Buscar membros
        members = db.query(
            AgentModel.name,
            TeamMemberModel.role_in_team
        ).join(
            TeamMemberModel,
            AgentModel.id == TeamMemberModel.agent_id
        ).filter(
            TeamMemberModel.team_id == team.id
        ).all()

        # Buscar informações do líder se houver
        leader_info = None
        if team.leader_agent_id:
            leader = db.query(AgentModel).filter(AgentModel.id == team.leader_agent_id).first()
            logger.info(f"🔍 TIME {team.name}: leader_agent_id={team.leader_agent_id}, leader encontrado: {leader.name if leader else 'None'}")
            if leader:
                leader_info = {
                    "id": leader.id,
                    "name": leader.name,
                    "role": leader.role
                }
                logger.info(f"👑 LEADER INFO: {leader_info}")

        # Construir lista de membros com mais detalhes
        members_detailed = []
        for member_name, member_role in members:
            # Buscar o agente completo
            agent = db.query(AgentModel).filter(AgentModel.name == member_name).first()
            if agent:
                members_detailed.append({
                    "agent_id": agent.id,
                    "role_in_team": member_role,
                    "agent": {
                        "id": agent.id,
                        "name": agent.name,
                        "role": agent.role
                    }
                })

        result.append({
            "id": team.id,
            "name": team.name,
            "description": team.description,
            "leader_agent_id": team.leader_agent_id,
            "leader": leader_info,
            "is_active": True,  # Assumir que times são ativos por padrão
            "created_at": team.created_at.isoformat() if team.created_at else None,
            "members": members_detailed,
            "_count": {
                "members": len(members_detailed)
            }
        })

    logger.info(f"✅ RETORNANDO {len(result)} TIMES PARA O FRONTEND")
    for team in result:
        logger.info(f"   📝 TEAM: {team['name']} (ID: {team['id']}) - {team['_count']['members']} membros")

    return result


class TeamCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    leader_agent_id: Optional[int] = None
    member_ids: List[int] = []

@teams_router.post("/")
async def create_team(
        request: TeamCreateRequest,
        db: Session = Depends(get_db)
):
    """Criar novo time de agentes"""
    try:
        logger.info(f"🔨 CRIANDO TIME - name: {request.name}, leader_agent_id: {request.leader_agent_id}, member_ids: {request.member_ids}")

        # Verificar nome único
        existing = db.query(AgentTeamModel).filter(AgentTeamModel.name == request.name).first()
        if existing:
            logger.error(f"❌ ERRO: Time '{request.name}' já existe (ID: {existing.id})")
            raise HTTPException(status_code=400, detail=f"Já existe um time com o nome '{request.name}'")

        # Criar time
        logger.info(f"🏗️ CRIANDO TIME NO BANCO: {request.name}")
        team = AgentTeamModel(
            name=request.name,
            description=request.description,
            leader_agent_id=request.leader_agent_id
        )
        db.add(team)
        db.commit()
        db.refresh(team)
        logger.info(f"✅ TIME CRIADO - ID: {team.id}")

        # Adicionar membros
        if request.member_ids:
            logger.info(f"👥 ADICIONANDO {len(request.member_ids)} MEMBROS AO TIME")
            for agent_id in request.member_ids:
                member = TeamMemberModel(
                    team_id=team.id,
                    agent_id=agent_id,
                    role_in_team="member"
                )
                db.add(member)
                logger.info(f"  ➕ Membro adicionado: agent_id={agent_id}")

            db.commit()
            logger.info(f"✅ MEMBROS ADICIONADOS COM SUCESSO")

        logger.info(f"🎉 TIME '{request.name}' CRIADO COM SUCESSO - ID: {team.id}")
        return {"id": team.id, "message": "Time criado com sucesso"}

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"❌ ERRO INTERNO AO CRIAR TIME: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@teams_router.get("/{team_id}")
def get_team(team_id: int, db: Session = Depends(get_db)):
    """Obter detalhes de um time específico"""
    team = db.query(AgentTeamModel).filter(AgentTeamModel.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Time não encontrado")

    # Buscar membros com informações completas
    members_query = db.query(
        TeamMemberModel.agent_id,
        TeamMemberModel.role_in_team,
        AgentModel.id,
        AgentModel.name,
        AgentModel.role
    ).join(
        AgentModel,
        AgentModel.id == TeamMemberModel.agent_id
    ).filter(
        TeamMemberModel.team_id == team_id
    ).all()

    # Buscar informações do líder se houver
    leader_info = None
    if team.leader_agent_id:
        leader = db.query(AgentModel).filter(AgentModel.id == team.leader_agent_id).first()
        if leader:
            leader_info = {
                "id": leader.id,
                "name": leader.name,
                "role": leader.role
            }

    # Estruturar membros no formato esperado pelo frontend
    members = []
    for member in members_query:
        members.append({
            "agent_id": member.agent_id,
            "role_in_team": member.role_in_team,
            "agent": {
                "id": member.id,
                "name": member.name,
                "role": member.role
            }
        })

    return {
        "id": team.id,
        "name": team.name,
        "description": team.description,
        "leader_agent_id": team.leader_agent_id,
        "leader": leader_info,
        "is_active": True,  # Por padrão, teams são ativos
        "created_at": team.created_at.isoformat() if hasattr(team.created_at, 'isoformat') else str(team.created_at),
        "members": members,
        "_count": {
            "members": len(members)
        }
    }


@teams_router.delete("/{team_id}")
def delete_team(team_id: int, db: Session = Depends(get_db)):
    """Deletar time"""
    team = db.query(AgentTeamModel).filter(AgentTeamModel.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Time não encontrado")

    # Deletar membros
    db.query(TeamMemberModel).filter(TeamMemberModel.team_id == team_id).delete()

    # Deletar time
    db.delete(team)
    db.commit()

    return {"message": "Time deletado com sucesso"}


class TeamExecuteRequest(BaseModel):
    task: str
    session_id: str

@teams_router.post("/{team_id}/execute")
async def execute_team_task(
        team_id: int,
        task: str = Form(...),
        session_id: str = Form(...),
        stream: bool = Form(False),
        customer_id: Optional[int] = Form(None),
        user_id: Optional[int] = Form(None),
        db: Session = Depends(get_db)
):
    """Executar tarefa com um time de agentes"""

    # ✅ DEBUG: Log valores ANTES da normalização
    logger.info(f"🔍 [RAW] customer_id recebido: {customer_id!r}, type: {type(customer_id)}")
    logger.info(f"🔍 [RAW] user_id recebido: {user_id!r}, type: {type(user_id)}")

    # ✅ NORMALIZAR customer_id e user_id (converter "null" string para None)
    if customer_id == "null" or customer_id == "undefined":
        customer_id = None
    if user_id == "null" or user_id == "undefined":
        user_id = None

    logger.info(f"🎯 RECEBIDO EXECUTE PARA TIME {team_id}")
    logger.info(f"📝 TAREFA: {task[:100]}...")
    logger.info(f"🆔 SESSION: {session_id}")
    logger.info(f"🔄 STREAM: {stream}")
    logger.info(f"👤 CUSTOMER: {customer_id}, USER: {user_id}")

    # Inicializar serviço de chat
    chat_service = ChatService(db)

    # Inicializar MongoDB chat service (se disponível)
    mongo_chat_svc = None
    try:
        from main import mongo_service
        if mongo_service is not None and mongo_service.is_connected:
            from mongo_chat_service import get_mongo_chat_service
            mongo_chat_svc = get_mongo_chat_service(mongo_service)
            logger.info("✅ MongoDB chat service inicializado")
    except Exception as e:
        logger.warning(f"⚠️ MongoDB chat service não disponível: {e}")

    # Buscar time
    team = db.query(AgentTeamModel).filter(AgentTeamModel.id == team_id).first()
    if not team:
        logger.error(f"❌ TIME {team_id} NÃO ENCONTRADO")
        raise HTTPException(status_code=404, detail="Time não encontrado")

    logger.info(f"✅ TIME ENCONTRADO: {team.name}")

    try:
        # ========================================
        # MONGODB - Criar sessão de chat
        # ========================================
        if mongo_chat_svc:
            await mongo_chat_svc.save_chat_session(
                chat_id=session_id,
                customer_id=customer_id,
                created_by=user_id,
                team_id=team_id
            )
            logger.info(f"✅ [MONGO] Sessão criada: {session_id}")

        # Calcular tokens da mensagem do usuário
        user_input_tokens = count_tokens_for_user_message(task)

        # Adicionar mensagem do usuário (MongoDB)
        user_metadata = {
            'sender': 'usuário',
            'sender_type': 'user',
            'session_id': session_id,
            'team_id': team_id,
            'team_name': team.name,
            'user_id': user_id,
            'customer_id': customer_id,
            'timestamp': datetime.now().isoformat(),
            'tokens': {
                'input': user_input_tokens,  # ✅ Usuário gasta tokens de INPUT
                'output': 0,                 # Usuário não gera output
                'total': user_input_tokens
            },
            'success': True,
            'model': 'user-input'
        }

        if mongo_chat_svc:
            await mongo_chat_svc.add_message_to_chat(
                chat_id=session_id,
                message_type="user",
                content=task,
                metadata=user_metadata
            )
            logger.info(f"✅ [MONGO] Mensagem do usuário salva")

        # ========================================
        # LEGACY: Manter PostgreSQL para compatibilidade (opcional)
        # ========================================
        try:
            chat_session = chat_service.get_or_create_session(session_id, team_id=team_id)
            chat_service.add_message(session_id, "user", task, user_metadata)
        except Exception as e:
            logger.warning(f"⚠️ [LEGACY] Erro ao salvar no PostgreSQL (ignorado): {e}")

        # Obter contexto da conversa
        context_history = chat_service.get_context_for_agent(session_id, max_messages=10)

        logger.info(f"📚 CONTEXTO DA CONVERSA ({len(context_history)} mensagens)")

        # Buscar membros
        members = db.query(AgentModel).join(
            TeamMemberModel,
            AgentModel.id == TeamMemberModel.agent_id
        ).filter(
            TeamMemberModel.team_id == team_id,
            AgentModel.is_active == True
        ).all()

        if not members:
            logger.error(f"❌ TIME {team_id} NÃO TEM MEMBROS ATIVOS")
            raise HTTPException(status_code=400, detail="Time não tem membros ativos")

        # Obter AgentManager do cache (mantém memória do Agno Team)
        from qdrant_service import QdrantService
        qdrant_service = QdrantService()
        agent_manager = agent_manager_cache.get(session_id, db, qdrant_service)

        # Log da execução
        logger.info(f"🚀 EXECUTANDO TAREFA COM TIME {team.name}")
        logger.info(f"👥 MEMBROS: {[m.name for m in members]}")

        if stream:
            # Implementar streaming simples - o agno já tem stream=True por padrão
            async def generate_stream():
                try:
                    start_time = time.time()

                    # Evento de início
                    yield f"data: {json.dumps({'type': 'start', 'team_name': team.name, 'members': [m.name for m in members]})}\n\n"

                    # Executar tarefa e simular streaming baseado na resposta do agno
                    # ✅ Passar session_id para manter o mesmo Team entre requests
                    result = agent_manager.execute_team_task_with_context(
                        team_id=team_id,
                        task=task,
                        context_history=context_history,
                        session_id=session_id
                    )

                    if result.get('success'):
                        response_content = result.get('team_response', '')
                        agent_name = result.get('agents_involved', ['Time'])[0] if result.get('agents_involved') else 'Time'

                        # ✅ STREAMING PALAVRA POR PALAVRA (igual ao coordenador)
                        words = response_content.split(' ')

                        for i, word in enumerate(words):
                            # Enviar apenas a palavra atual (não o texto acumulado)
                            word_with_space = word + (' ' if i < len(words) - 1 else '')
                            yield f"data: {json.dumps({'type': 'content', 'content': word_with_space, 'agent_name': agent_name})}\n\n"
                            await asyncio.sleep(0.03)  # Delay de 30ms

                        # ✅ CONSTRUIR METADATA ENRIQUECIDO usando função auxiliar
                        response_metadata = build_team_response_metadata(
                            result=result,
                            team_id=team_id,
                            team_name=team.name,
                            start_time=start_time
                        )

                        # Salvar mensagem e capturar ID gerado
                        message_id = None
                        if mongo_chat_svc:
                            message_id = await mongo_chat_svc.add_message_to_chat(
                                chat_id=session_id,
                                message_type="team",
                                content=response_content,
                                metadata=response_metadata
                            )
                            if message_id:
                                logger.info(f"✅ [MONGO] Resposta do time salva com ID: {message_id}")
                            else:
                                logger.error(f"❌ [MONGO] Falha ao salvar resposta do time")

                        # Legacy PostgreSQL (opcional)
                        try:
                            chat_service.add_message(session_id, "team", response_content, response_metadata)
                        except Exception as e:
                            logger.warning(f"⚠️ [LEGACY] Erro ao salvar no PostgreSQL: {e}")

                        # Evento de conclusão com message_id
                        completion_event = {
                            'type': 'completed',
                            'execution_time_ms': int((time.time() - start_time) * 1000)
                        }
                        if message_id:
                            completion_event['message_id'] = message_id

                        yield f"data: {json.dumps(completion_event)}\n\n"
                        # [DONE] deve ser enviado sem JSON para SSE padrão
                        yield "data: [DONE]\n\n"
                    else:
                        yield f"data: {json.dumps({'type': 'error', 'message': result.get('error', 'Erro na execução')})}\n\n"
                        # [DONE] deve ser enviado sem JSON para SSE padrão
                        yield "data: [DONE]\n\n"

                except Exception as e:
                    logger.error(f"❌ ERRO NO STREAMING: {e}")
                    yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                    # [DONE] deve ser enviado sem JSON para SSE padrão
                    yield "data: [DONE]\n\n"

            return StreamingResponse(
                generate_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Content-Type": "text/event-stream",
                }
            )
        else:
            # Executar tarefa com o time (incluindo contexto) - modo síncrono
            start_time = time.time()
            # ✅ Passar session_id para manter o mesmo Team entre requests
            result = agent_manager.execute_team_task_with_context(
                team_id=team_id,
                task=task,
                context_history=context_history,
                session_id=session_id
            )
            execution_time_ms = int((time.time() - start_time) * 1000)

            if not result.get('execution_time_ms'):
                result['execution_time_ms'] = execution_time_ms

            logger.info(f"✅ EXECUÇÃO CONCLUÍDA - Sucesso: {result.get('success', False)}")

            # Salvar resposta do time (MongoDB)
            if result.get('success'):
                # ✅ CONSTRUIR METADATA ENRIQUECIDO usando função auxiliar
                response_metadata = build_team_response_metadata(
                    result=result,
                    team_id=team_id,
                    team_name=team.name,
                    start_time=start_time
                )

                if mongo_chat_svc:
                    await mongo_chat_svc.add_message_to_chat(
                        chat_id=session_id,
                        message_type="team",
                        content=result.get('team_response', ''),
                        metadata=response_metadata
                    )
                    logger.info(f"✅ [MONGO] Resposta do time salva")

                # Legacy PostgreSQL (opcional)
                try:
                    chat_service.add_message(session_id, "team", result.get('team_response', ''), response_metadata)
                except Exception as e:
                    logger.warning(f"⚠️ [LEGACY] Erro ao salvar no PostgreSQL: {e}")

            # Adicionar informações do time na resposta
            result['team_info'] = {
                'id': team.id,
                'name': team.name,
                'members': [
                    {'id': m.id, 'name': m.name, 'role': m.role}
                    for m in members
                ]
            }

            return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ ERRO INTERNO AO EXECUTAR TIME {team_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")