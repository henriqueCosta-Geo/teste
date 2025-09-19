from fastapi import APIRouter, Depends, HTTPException, Form, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import logging
from sqlalchemy import func
from datetime import datetime
import asyncio
import time
from agents import AgentManager

logger = logging.getLogger(__name__)

# Import MetricsCollector for real-time analytics
try:
    from metrics_collector import MetricsCollector
    metrics_collector = MetricsCollector()
except ImportError as e:
    logger.warning(f"MetricsCollector not available: {e}")
    metrics_collector = None

from database import get_db
from agents import AgentManager, create_agent, assign_collection_to_agent
from chat_service import ChatService
from agent_models import (
    Agent as AgentModel,
    AgentTeam as AgentTeamModel,
    TeamMember as TeamMemberModel,
    AgentCollection as AgentCollectionModel,
    AgentSession as AgentSessionModel,
    AgentExecution as AgentExecutionModel,
    ChatSession,
    ChatMessage
)
from models import Collection as CollectionModel

# Criar router
agent_router = APIRouter(prefix="/api/agents", tags=["agents"])


# ============================================================================
# CRUD de Agentes
# ============================================================================

@agent_router.get("/")
def list_agents(
        db: Session = Depends(get_db),
        include_collections: bool = Query(False)
):
    """Listar todos os agentes"""
    agents = db.query(AgentModel).filter(AgentModel.is_active == True).all()

    result = []
    for agent in agents:
        agent_data = {
            "id": agent.id,
            "name": agent.name,
            "description": agent.description,
            "role": agent.role,
            "model": agent.model,
            "temperature": agent.temperature,
            "tools_config": agent.tools_config,
            "is_active": agent.is_active,
            "created_at": agent.created_at
        }

        if include_collections:
            # Incluir coleções associadas
            collections = db.query(
                CollectionModel.name,
                CollectionModel.id,
                AgentCollectionModel.access_level,
                AgentCollectionModel.priority
            ).join(
                AgentCollectionModel,
                CollectionModel.id == AgentCollectionModel.collection_id
            ).filter(
                AgentCollectionModel.agent_id == agent.id
            ).all()

            agent_data["collections"] = [
                {
                    "id": c.id,
                    "name": c.name,
                    "access_level": c.access_level,
                    "priority": c.priority
                }
                for c in collections
            ]

        result.append(agent_data)

    return result


@agent_router.get("/{agent_id}")
def get_agent(agent_id: int, db: Session = Depends(get_db)):
    """Obter detalhes de um agente específico"""
    agent = db.query(AgentModel).filter(AgentModel.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    # Buscar coleções associadas
    collections = db.query(
        CollectionModel.name,
        CollectionModel.id,
        AgentCollectionModel.access_level,
        AgentCollectionModel.priority
    ).join(
        AgentCollectionModel,
        CollectionModel.id == AgentCollectionModel.collection_id
    ).filter(
        AgentCollectionModel.agent_id == agent_id
    ).all()

    # Buscar estatísticas de execução
    total_executions = db.query(AgentExecutionModel).filter(
        AgentExecutionModel.agent_id == agent_id
    ).count()

    avg_execution_time = db.query(
        func.avg(AgentExecutionModel.execution_time_ms)
    ).filter(
        AgentExecutionModel.agent_id == agent_id
    ).scalar() or 0

    return {
        "id": agent.id,
        "name": agent.name,
        "description": agent.description,
        "role": agent.role,
        "model": agent.model,
        "temperature": agent.temperature,
        "instructions": agent.instructions,
        "tools_config": agent.tools_config,
        "is_active": agent.is_active,
        "created_at": agent.created_at,
        "collections": [
            {
                "id": c.id,
                "name": c.name,
                "access_level": c.access_level,
                "priority": c.priority
            }
            for c in collections
        ],
        "stats": {
            "total_executions": total_executions,
            "avg_execution_time_ms": int(avg_execution_time)
        }
    }


from pydantic import BaseModel

class AgentCreateRequest(BaseModel):
    name: str
    description: str = ""
    role: str = ""
    model: str = "gpt-4o-mini"
    temperature: float = 0.7
    instructions: str = ""
    tools_config: list = ["rag"]

@agent_router.post("/")
async def create_new_agent(
        request: AgentCreateRequest,
        db: Session = Depends(get_db)
):
    """Criar novo agente"""
    try:
        # Log do que chegou no backend
        logger.info("🎯 BACKEND - Dados recebidos:")
        logger.info(f"  name: '{request.name}' (type: {type(request.name).__name__})")
        logger.info(f"  description: '{request.description}' (type: {type(request.description).__name__})")
        logger.info(f"  role: '{request.role}' (type: {type(request.role).__name__})")
        logger.info(f"  model: '{request.model}' (type: {type(request.model).__name__})")
        logger.info(f"  temperature: {request.temperature} (type: {type(request.temperature).__name__})")
        logger.info(f"  instructions: '{request.instructions}' (type: {type(request.instructions).__name__})")
        logger.info(f"  tools_config: {request.tools_config} (type: {type(request.tools_config).__name__})")
        
        # Verificar se nome já existe
        existing = db.query(AgentModel).filter(AgentModel.name == request.name).first()
        if existing:
            logger.error(f"❌ ERRO: Agente '{request.name}' já existe (ID: {existing.id})")
            raise HTTPException(status_code=400, detail=f"Já existe um agente com o nome '{request.name}'")

        # Parse tools_config se for string JSON
        tools_config = request.tools_config
        if isinstance(tools_config, str):
            import json
            try:
                tools_config = json.loads(tools_config)
            except:
                tools_config = ["rag"]
        
        # Converter temperature para float
        try:
            temperature_float = float(request.temperature)
        except:
            temperature_float = 0.7

        logger.info(f"🔧 CRIANDO AGENTE - nome: '{request.name}', tools processadas: {tools_config}")

        # Criar agente
        agent = AgentModel(
            name=request.name,
            description=request.description,
            role=request.role,
            model=request.model,
            temperature=temperature_float,
            instructions=request.instructions,
            tools_config=tools_config
        )

        db.add(agent)
        db.commit()
        db.refresh(agent)

        logger.info(f"✅ AGENTE CRIADO COM SUCESSO - ID: {agent.id}")
        return {"id": agent.id, "message": "Agente criado com sucesso"}
    
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"❌ ERRO INTERNO AO CRIAR AGENTE: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@agent_router.put("/{agent_id}")
async def update_agent(
        agent_id: int,
        name: Optional[str] = Form(None),
        description: Optional[str] = Form(None),
        role: Optional[str] = Form(None),
        model: Optional[str] = Form(None),
        temperature: Optional[float] = Form(None),
        instructions: Optional[str] = Form(None),
        tools_config: Optional[str] = Form(None),
        is_active: Optional[bool] = Form(None),
        db: Session = Depends(get_db)
):
    """Atualizar agente existente"""
    agent = db.query(AgentModel).filter(AgentModel.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    # Atualizar campos fornecidos
    if name is not None:
        agent.name = name
    if description is not None:
        agent.description = description
    if role is not None:
        agent.role = role
    if model is not None:
        agent.model = model
    if temperature is not None:
        agent.temperature = temperature
    if instructions is not None:
        agent.instructions = instructions
    if tools_config is not None:
        agent.tools_config = json.loads(tools_config)
    if is_active is not None:
        agent.is_active = is_active

    db.commit()

    # Limpar cache do agente
    from qdrant_service import QdrantService
    qdrant_service = QdrantService()
    agent_manager = AgentManager(db, qdrant_service)
    agent_manager.clear_agent_cache(agent_id)

    return {"message": "Agente atualizado com sucesso"}


@agent_router.delete("/{agent_id}")
def delete_agent(agent_id: int, db: Session = Depends(get_db)):
    """Deletar agente (soft delete)"""
    agent = db.query(AgentModel).filter(AgentModel.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    # Soft delete
    agent.is_active = False
    db.commit()

    return {"message": "Agente desativado com sucesso"}


# ============================================================================
# Gestão de Coleções RAG
# ============================================================================

class AssignCollectionRequest(BaseModel):
    collection_id: int
    access_level: str = "read"
    priority: int = 0

@agent_router.post("/{agent_id}/collections")
async def assign_collection(
        agent_id: int,
        request: AssignCollectionRequest,
        db: Session = Depends(get_db)
):
    """Associar coleção a um agente"""
    # Verificar se agente e coleção existem
    agent = db.query(AgentModel).filter(AgentModel.id == agent_id).first()
    collection = db.query(CollectionModel).filter(CollectionModel.id == request.collection_id).first()

    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")
    if not collection:
        raise HTTPException(status_code=404, detail="Coleção não encontrada")

    result = await assign_collection_to_agent(db, agent_id, request.collection_id, request.access_level, request.priority)

    # Limpar cache do agente
    from qdrant_service import QdrantService
    qdrant_service = QdrantService()
    agent_manager = AgentManager(db, qdrant_service)
    agent_manager.clear_agent_cache(agent_id)

    return result


@agent_router.delete("/{agent_id}/collections/{collection_id}")
def remove_collection(
        agent_id: int,
        collection_id: int,
        db: Session = Depends(get_db)
):
    """Remover associação entre agente e coleção"""
    relation = db.query(AgentCollectionModel).filter(
        AgentCollectionModel.agent_id == agent_id,
        AgentCollectionModel.collection_id == collection_id
    ).first()

    if not relation:
        raise HTTPException(status_code=404, detail="Relacionamento não encontrado")

    db.delete(relation)
    db.commit()

    # Limpar cache do agente
    from qdrant_service import QdrantService
    qdrant_service = QdrantService()
    agent_manager = AgentManager(db, qdrant_service)
    agent_manager.clear_agent_cache(agent_id)

    return {"message": "Coleção removida do agente"}


# ============================================================================
# Chat e Execução
# ============================================================================

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

@agent_router.post("/{agent_id}/chat")
async def chat_with_agent(
        agent_id: int,
        request: ChatRequest,
        db: Session = Depends(get_db)
):
    """Conversar com um agente usando suas bases RAG"""
    # Buscar agente
    agent = db.query(AgentModel).filter(AgentModel.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    if not agent.is_active:
        raise HTTPException(status_code=400, detail="Agente está desativado")

    # Criar manager e executar
    from qdrant_service import QdrantService
    qdrant_service = QdrantService()
    agent_manager = AgentManager(db, qdrant_service)

    # Converter modelo para dict
    agent_config = {
        "id": agent.id,
        "name": agent.name,
        "role": agent.role,
        "model": agent.model,
        "temperature": agent.temperature,
        "instructions": agent.instructions,
        "tools_config": agent.tools_config
    }

    # Executar tarefa
    start_time = time.time()
    result = agent_manager.execute_agent_task(agent_config, request.message, request.session_id)
    execution_time_ms = int((time.time() - start_time) * 1000)
    
    # Atualizar execution_time_ms se não foi fornecido
    if not result.get('execution_time_ms'):
        result['execution_time_ms'] = execution_time_ms

    # Salvar execução no banco
    if result.get('success'):
        execution = AgentExecutionModel(
            agent_id=agent_id,
            input_text=request.message,
            output_text=result.get('response'),
            tools_used=result.get('tools_used', []),
            execution_time_ms=result.get('execution_time_ms')
        )
        db.add(execution)
        db.commit()
        
        # Coletar métricas assíncronas (não bloqueia a resposta)
        if metrics_collector:
            try:
                asyncio.create_task(metrics_collector.collect_execution_metrics({
                    'agent_id': agent_id,
                    'agent_name': agent.name,
                    'model': agent.model,
                    'execution_time_ms': result.get('execution_time_ms', 0),
                    'input_text': request.message,
                    'output_text': result.get('response', ''),
                    'input_tokens': int(len(request.message.split()) * 1.3),  # Estimativa
                    'output_tokens': int(len(result.get('response', '').split()) * 1.3),  # Estimativa
                    'tools_used': result.get('tools_used', []),
                    'session_id': request.session_id or f"agent-{agent_id}-{int(time.time())}",
                    'success': True
                }))
                
                asyncio.create_task(metrics_collector.collect_content_metrics({
                    'content_id': f"agent-{agent_id}-{int(time.time())}",
                    'content_type': "agent_chat",
                    'message_content': f"{request.message}\n---RESPONSE---\n{result.get('response', '')}",
                    'agent_id': agent_id,
                    'agent_name': agent.name,
                    'session_id': request.session_id or f"agent-{agent_id}-{int(time.time())}"
                }))
            except Exception as e:
                logger.error(f"Error collecting metrics: {e}")

    return result


# ============================================================================
# Times de Agentes
# ============================================================================

@agent_router.get("/teams/")
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

@agent_router.post("/teams/")
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


@agent_router.get("/teams/{team_id}")
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


@agent_router.put("/teams/{team_id}")
async def update_team(
        team_id: int,
        name: str = Form(...),
        description: str = Form(None),
        leader_agent_id: Optional[int] = Form(None),
        member_ids: str = Form("[]"),
        db: Session = Depends(get_db)
):
    """Atualizar time existente"""
    team = db.query(AgentTeamModel).filter(AgentTeamModel.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Time não encontrado")

    # Atualizar dados básicos
    team.name = name
    team.description = description
    team.leader_agent_id = leader_agent_id

    # Remover membros antigos
    db.query(TeamMemberModel).filter(TeamMemberModel.team_id == team_id).delete()

    # Adicionar novos membros
    member_ids_list = json.loads(member_ids)
    for agent_id in member_ids_list:
        member = TeamMemberModel(
            team_id=team_id,
            agent_id=agent_id,
            role_in_team="member"
        )
        db.add(member)

    db.commit()

    return {"message": "Time atualizado com sucesso"}


@agent_router.delete("/teams/{team_id}")
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

@agent_router.post("/teams/{team_id}/execute")
async def execute_team_task(
        team_id: int,
        request: TeamExecuteRequest,
        db: Session = Depends(get_db)
):
    """Executar tarefa com um time de agentes"""
    logger.info(f"🎯 RECEBIDO EXECUTE PARA TIME {team_id}")
    logger.info(f"📝 TAREFA: {request.task[:100]}...")
    logger.info(f"🆔 SESSION: {request.session_id}")
    
    # Inicializar serviço de chat
    chat_service = ChatService(db)
    
    # Buscar time
    team = db.query(AgentTeamModel).filter(AgentTeamModel.id == team_id).first()
    if not team:
        logger.error(f"❌ TIME {team_id} NÃO ENCONTRADO")
        raise HTTPException(status_code=404, detail="Time não encontrado")
    
    logger.info(f"✅ TIME ENCONTRADO: {team.name}")
    
    try:
        # Criar/obter sessão de chat
        chat_session = chat_service.get_or_create_session(request.session_id, team_id=team_id)
    
        # Adicionar mensagem do usuário ao histórico com informações do remetente
        user_metadata = {
            'sender': 'usuário',
            'session_id': request.session_id,
            'team_id': team_id,
            'timestamp': datetime.now().isoformat()
        }
        chat_service.add_message(request.session_id, "user", request.task, user_metadata)
        
        # Obter contexto da conversa
        context_history = chat_service.get_context_for_agent(request.session_id, max_messages=10)
        
        logger.info(f"📚 CONTEXTO DA CONVERSA ({len(context_history)} mensagens): {[msg['content'][:50] + '...' for msg in context_history]}")

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

        # Preparar configurações dos membros
        member_configs = []
        for member in members:
            member_configs.append({
                "id": member.id,
                "name": member.name,
                "role": member.role,
                "model": member.model,
                "temperature": member.temperature,
                "instructions": member.instructions,
                "tools_config": member.tools_config
            })

        # Criar manager e executar
        from qdrant_service import QdrantService
        qdrant_service = QdrantService()
        agent_manager = AgentManager(db, qdrant_service)

        # Configuração do líder se houver
        leader_config = None
        leader = None
        if team.leader_agent_id:
            leader = db.query(AgentModel).filter(AgentModel.id == team.leader_agent_id).first()
            if leader:
                leader_config = {
                    "id": leader.id,
                    "name": leader.name,
                    "role": leader.role,
                    "model": leader.model,
                    "temperature": leader.temperature,
                    "instructions": leader.instructions,
                    "tools_config": leader.tools_config
                }

        # Log da execução
        logger.info(f"🚀 EXECUTANDO TAREFA COM TIME {team.name}")
        logger.info(f"📋 TAREFA: {request.task[:100]}...")
        logger.info(f"👑 LÍDER: {leader.name if leader else 'Nenhum'}")
        logger.info(f"👥 MEMBROS: {[m.name for m in members]}")
        
        # Executar tarefa com o time (incluindo contexto)
        start_time = time.time()
        result = agent_manager.execute_team_task_with_context(team_id, request.task, context_history)
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        # Atualizar execution_time_ms se não foi fornecido
        if not result.get('execution_time_ms'):
            result['execution_time_ms'] = execution_time_ms
        
        logger.info(f"✅ EXECUÇÃO CONCLUÍDA - Sucesso: {result.get('success', False)}")
    
        # Coletar métricas assíncronas para times (não bloqueia a resposta)
        if metrics_collector and result.get('success'):
            try:
                # Métricas de execução para cada membro do time
                for member in members:
                    asyncio.create_task(metrics_collector.collect_execution_metrics({
                        'agent_id': member.id,
                        'agent_name': member.name,
                        'model': member.model,
                        'execution_time_ms': result.get('execution_time_ms', 0) // len(members),  # Tempo dividido
                        'input_text': request.task,  # Texto completo para estimativa precisa
                        'output_text': result.get('team_response', ''),  # Resposta completa
                        'tools_used': result.get('tools_used', []),
                        'session_id': request.session_id,
                        'success': True,
                        'team_execution': True,
                        'team_id': team_id,
                        'team_name': team.name,
                        'operation_type': 'team_chat',
                        'timestamp': datetime.now().isoformat()
                    }))
                
                # Métricas de conteúdo para o time
                asyncio.create_task(metrics_collector.collect_content_metrics({
                    'content_id': f"team-{team_id}-{int(time.time())}",
                    'content_type': "team_execution",
                    'message_content': request.task,
                    'response_content': result.get('team_response', ''),
                    'agent_id': team.leader_agent_id,
                    'agent_name': f"Team-{team.name}",
                    'session_id': request.session_id,
                    'team_execution': True,
                    'team_id': team_id,
                    'agents_involved': result.get('agents_involved', []),
                    'timestamp': datetime.now().isoformat()
                }))
                
                # Métricas de sessão
                asyncio.create_task(metrics_collector.collect_session_metrics({
                    'session_id': request.session_id,
                    'user_id': 'team_user',
                    'agent_id': team.leader_agent_id,
                    'team_id': team_id,
                    'message_count': 1,
                    'duration_seconds': result.get('execution_time_ms', 0) // 1000,
                    'agents_used': [member.id for member in members],
                    'timestamp': datetime.now().isoformat()
                }))
            except Exception as e:
                logger.error(f"Error collecting team metrics: {e}")
        
        # ==========================================
        # ANÁLISE DE CONVERSA REMOVIDA - AGORA SÓ ACONTECE AO FECHAR JANELA
        # ==========================================
        
        # Análise automática por despedida foi removida
        # Agora só acontece quando o usuário fechar a janela do chat

        # Salvar resposta no histórico com informações detalhadas
        if result.get('success'):
            response_metadata = {
                'execution_time_ms': result.get('execution_time_ms'),
                'agents_involved': result.get('agents_involved', []),
                'team_id': team_id,
                'sender': f"time-{team.name}",
                'leader': leader.name if leader else 'sem-líder',
                'context_used': result.get('context_used', 0),
                'rag_info': result.get('rag_info', {}),
                'timestamp': datetime.now().isoformat()
            }
            chat_service.add_message(request.session_id, "team", result.get('team_response', ''), response_metadata)
        else:
            error_metadata = {
                'team_id': team_id,
                'sender': f"time-{team.name}",
                'error_type': 'execution_error',
                'timestamp': datetime.now().isoformat()
            }
            chat_service.add_message(request.session_id, "error", result.get('error', 'Erro desconhecido'), error_metadata)
        
        # Adicionar informações do time na resposta
        result['team_info'] = {
            'id': team.id,
            'name': team.name,
            'leader': {
                'id': leader.id,
                'name': leader.name,
                'role': leader.role
            } if leader else None,
            'members': [
                {'id': m.id, 'name': m.name, 'role': m.role}
                for m in members
            ]
        }
    
        # Log das informações de RAG para debug
        if result.get('rag_info', {}).get('rag_used'):
            logger.info(f"📊 RAG INFO: {result['rag_info']['total_searches']} buscas, {result['rag_info']['total_results']} resultados")

        return result
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"❌ ERRO INTERNO AO EXECUTAR TIME {team_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@agent_router.get("/chat/history/{session_id}")
def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    """Obter histórico de chat de uma sessão"""
    chat_service = ChatService(db)
    messages = chat_service.get_chat_history(session_id, limit=50)
    
    return {
        "session_id": session_id,
        "messages": [
            {
                "id": msg.id,
                "type": msg.message_type,
                "content": msg.content,
                "metadata": msg.message_metadata,
                "timestamp": msg.created_at.isoformat()
            }
            for msg in messages
        ]
    }


# ============================================================================
# Estatísticas e Monitoramento
# ============================================================================

@agent_router.get("/stats/overview")
def get_stats_overview(db: Session = Depends(get_db)):
    """Obter estatísticas gerais do sistema de agentes"""
    total_agents = db.query(AgentModel).count()
    active_agents = db.query(AgentModel).filter(AgentModel.is_active == True).count()
    total_teams = db.query(AgentTeamModel).count()
    total_executions = db.query(AgentExecutionModel).count()

    # Execuções nas últimas 24h
    from datetime import datetime, timedelta
    yesterday = datetime.now() - timedelta(days=1)
    recent_executions = db.query(AgentExecutionModel).filter(
        AgentExecutionModel.created_at >= yesterday
    ).count()

    # Agentes mais usados
    from sqlalchemy import func
    top_agents = db.query(
        AgentModel.name,
        func.count(AgentExecutionModel.id).label('execution_count')
    ).join(
        AgentExecutionModel,
        AgentModel.id == AgentExecutionModel.agent_id
    ).group_by(
        AgentModel.id
    ).order_by(
        func.count(AgentExecutionModel.id).desc()
    ).limit(5).all()

    return {
        "total_agents": total_agents,
        "active_agents": active_agents,
        "total_teams": total_teams,
        "total_executions": total_executions,
        "recent_executions_24h": recent_executions,
        "top_agents": [
            {"name": agent.name, "executions": agent.execution_count}
            for agent in top_agents
        ]
    }


@agent_router.post("/chat/{session_id}/close")
async def close_chat_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    Endpoint para fechar sessão de chat e disparar análise de conversa
    """
    from chat_service import ChatService
    from metrics_collector import metrics_collector
    
    chat_service = ChatService(db)
    
    try:
        # Obter histórico completo da sessão
        messages = chat_service.get_chat_history(session_id)
        
        if not messages:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
        # Preparar dados da conversa para classificação
        conversation_data = {
            'session_id': session_id,
            'messages': [
                {
                    'sender': getattr(msg, 'message_type', 'user'),
                    'content': getattr(msg, 'content', ''),
                    'timestamp': getattr(msg, 'created_at', '').isoformat() if hasattr(msg, 'created_at') and msg.created_at else '',
                    'metadata': getattr(msg, 'message_metadata', {}) or {}
                }
                for msg in messages
            ],
            'total_messages': len(messages),
            'session_duration': None,  # Será calculado se possível
        }
        
        # Calcular duração da sessão se possível
        if len(messages) >= 2:
            try:
                from datetime import datetime
                first_msg = messages[0]
                last_msg = messages[-1]
                
                if hasattr(first_msg, 'created_at') and hasattr(last_msg, 'created_at') and first_msg.created_at and last_msg.created_at:
                    duration_seconds = (last_msg.created_at - first_msg.created_at).total_seconds()
                    conversation_data['session_duration'] = duration_seconds
                
            except Exception as e:
                logger.warning(f"⚠️ Erro ao calcular duração da sessão: {e}")
        
        # Extrair informações adicionais
        user_id = 'anonymous'
        agent_id = None
        team_id = None
        
        for msg in messages:
            metadata = getattr(msg, 'message_metadata', {}) or {}
            if isinstance(metadata, dict) and metadata.get('user_id'):
                user_id = metadata['user_id']
            if isinstance(metadata, dict) and metadata.get('agent_id'):
                agent_id = metadata['agent_id']
            if isinstance(metadata, dict) and metadata.get('team_id'):
                team_id = metadata['team_id']
        
        conversation_data.update({
            'user_id': user_id,
            'agent_id': agent_id,
            'team_id': team_id
        })
        
        # Disparar análise de conversa via Redis
        if metrics_collector:
            await metrics_collector.request_conversation_classification(session_id, conversation_data)
            logger.info(f"🎯 Análise de conversa solicitada para sessão: {session_id}")
        
        # Marcar sessão como fechada (opcional - implementar se necessário)
        # chat_service.close_session(session_id)
        
        return {
            "success": True,
            "session_id": session_id,
            "message": "Sessão fechada e análise iniciada",
            "conversation_summary": {
                "total_messages": len(messages),
                "duration_seconds": conversation_data.get('session_duration'),
                "user_id": user_id,
                "team_id": team_id,
                "classification_requested": metrics_collector is not None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao fechar sessão de chat: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@agent_router.post("/chat/{session_id}/auto-close")
async def auto_close_chat_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    Endpoint para fechamento automático de sessão (chamado via beforeunload no frontend)
    Mais leve que o fechamento manual - só dispara análise se sessão tiver mais de 2 mensagens
    """
    from chat_service import ChatService
    from metrics_collector import metrics_collector
    
    chat_service = ChatService(db)
    
    try:
        # Obter apenas contagem de mensagens para decisão rápida
        messages = chat_service.get_session_messages(session_id)
        
        if not messages or len(messages) < 3:  # Mínimo 3 mensagens para análise
            return {
                "success": True,
                "session_id": session_id,
                "message": "Sessão fechada sem análise (muito poucas mensagens)",
                "analysis_triggered": False
            }
        
        # Preparar dados básicos para análise
        conversation_data = {
            'session_id': session_id,
            'messages': messages,  # Passar mensagens completas
            'total_messages': len(messages),
            'auto_close': True,  # Flag para indicar fechamento automático
        }
        
        # Extrair IDs importantes
        last_message = messages[-1]
        metadata = getattr(last_message, 'message_metadata', {}) or {}
        
        conversation_data.update({
            'user_id': metadata.get('user_id', 'anonymous') if isinstance(metadata, dict) else 'anonymous',
            'agent_id': metadata.get('agent_id') if isinstance(metadata, dict) else None,
            'team_id': metadata.get('team_id') if isinstance(metadata, dict) else None
        })
        
        # Disparar análise assíncrona
        if metrics_collector:
            await metrics_collector.request_conversation_classification(session_id, conversation_data)
            logger.info(f"🤖 Análise automática solicitada para sessão: {session_id}")
            analysis_triggered = True
        else:
            analysis_triggered = False
        
        return {
            "success": True,
            "session_id": session_id,
            "message": "Sessão fechada automaticamente",
            "analysis_triggered": analysis_triggered,
            "total_messages": len(messages)
        }
        
    except Exception as e:
        # Em caso de erro, não levantar exception - apenas logar
        logger.error(f"❌ Erro no fechamento automático da sessão {session_id}: {e}")
        return {
            "success": False,
            "session_id": session_id,
            "error": str(e),
            "analysis_triggered": False
        }


@agent_router.get("/metrics/debug")  
async def debug_metrics_tables(db: Session = Depends(get_db)):
    """Debug: verificar se dados estão chegando nas tabelas"""
    try:
        from sqlalchemy import text
        
        # Contar registros em cada tabela
        token_count = db.execute(text("SELECT COUNT(*) FROM token_usage")).scalar()
        user_count = db.execute(text("SELECT COUNT(*) FROM user_metrics")).scalar()  
        content_count = db.execute(text("SELECT COUNT(*) FROM content_topics")).scalar()
        
        # Últimos registros de cada tabela
        latest_tokens = db.execute(text("""
            SELECT agent_id, model_used, input_tokens, output_tokens, cost_estimate, created_at 
            FROM token_usage ORDER BY created_at DESC LIMIT 3
        """)).fetchall()
        
        latest_content = db.execute(text("""
            SELECT session_id, extracted_topics, created_at 
            FROM content_topics ORDER BY created_at DESC LIMIT 3  
        """)).fetchall()
        
        return {
            "counts": {
                "token_usage": token_count,
                "user_metrics": user_count, 
                "content_topics": content_count
            },
            "latest_tokens": [
                {
                    "agent_id": row.agent_id,
                    "model": row.model_used, 
                    "input_tokens": row.input_tokens,
                    "output_tokens": row.output_tokens,
                    "cost": float(row.cost_estimate),
                    "created_at": row.created_at.isoformat()
                }
                for row in latest_tokens
            ],
            "latest_content": [
                {
                    "session_id": row.session_id,
                    "topics": row.extracted_topics,
                    "created_at": row.created_at.isoformat()  
                }
                for row in latest_content
            ]
        }
        
    except Exception as e:
        return {"error": str(e)}

@agent_router.post("/chat/close-all")
async def close_all_sessions():
    """Endpoint SUPER SIMPLES para o frontend chamar quando fechar"""
    try:
        from database import SessionLocal
        from chat_service import ChatService  
        from metrics_collector import metrics_collector
        from sqlalchemy import text
        from datetime import datetime, timedelta
        
        db = SessionLocal()
        
        # Pegar todas as sessões ativas das últimas 2 horas
        cutoff = datetime.now() - timedelta(hours=2)
        
        active_sessions = db.execute(text("""
            SELECT DISTINCT session_id, team_id 
            FROM chat_sessions 
            WHERE last_activity >= :cutoff
            ORDER BY last_activity DESC
            LIMIT 50
        """), {'cutoff': cutoff}).fetchall()
        
        analyzed = 0
        
        for session in active_sessions:
            try:
                chat_service = ChatService(db)
                messages = chat_service.get_session_messages(session.session_id)
                
                if messages and len(messages) >= 3:
                    conversation_data = {
                        'session_id': session.session_id,
                        'messages': messages,
                        'total_messages': len(messages),
                        'auto_triggered': True,
                        'trigger_reason': 'frontend_close',
                        'user_id': 'frontend_close',
                        'team_id': session.team_id
                    }
                    
                    if metrics_collector:
                        await metrics_collector.request_conversation_classification(session.session_id, conversation_data)
                        analyzed += 1
                        
            except Exception as e:
                logger.error(f"❌ Erro ao analisar sessão {session.session_id}: {e}")
        
        db.close()
        
        return {
            "success": True,
            "message": f"Análise de {analyzed} sessões solicitada",
            "sessions_found": len(active_sessions),
            "sessions_analyzed": analyzed
        }
        
    except Exception as e:
        logger.error(f"❌ Erro no fechamento geral: {e}")
        return {"success": False, "error": str(e)}

@agent_router.get("/metrics/realtime")
async def get_realtime_metrics(db: Session = Depends(get_db)):
    """
    Endpoint para métricas em tempo real - melhorada para dashboard
    """
    from metrics_collector import metrics_collector
    
    try:
        # Métricas em tempo real do Redis
        realtime_data = {}
        if metrics_collector:
            realtime_data = await metrics_collector.get_real_time_metrics()
        
        # Métricas do banco de dados
        from sqlalchemy import func, text
        from datetime import datetime, timedelta
        
        # Últimas 24 horas
        yesterday = datetime.now() - timedelta(days=1)
        
        # Total de tokens consumidos hoje
        token_usage = db.execute(text("""
            SELECT 
                COALESCE(SUM(input_tokens), 0) as total_input_tokens,
                COALESCE(SUM(output_tokens), 0) as total_output_tokens,
                COALESCE(SUM(cost_estimate), 0) as total_cost
            FROM token_usage 
            WHERE created_at >= :yesterday
        """), {'yesterday': yesterday}).fetchone()
        
        # Sessões ativas nas últimas 24h
        active_sessions = db.execute(text("""
            SELECT COUNT(DISTINCT session_id) as count
            FROM user_metrics 
            WHERE updated_at >= :yesterday
        """), {'yesterday': yesterday}).fetchone()
        
        # Top agentes por uso
        top_agents = db.execute(text("""
            SELECT 
                a.name,
                COUNT(pm.id) as executions,
                COALESCE(AVG(pm.avg_response_time_ms), 0) as avg_response_time
            FROM agents a
            LEFT JOIN performance_metrics pm ON a.id = pm.agent_id
            WHERE pm.metric_date >= :yesterday
            GROUP BY a.id, a.name
            ORDER BY executions DESC
            LIMIT 5
        """), {'yesterday': yesterday.date()}).fetchall()
        
        # Classificações recentes
        recent_classifications = db.execute(text("""
            SELECT 
                issue_category,
                COUNT(*) as count,
                AVG(rating) as avg_rating
            FROM user_feedback 
            WHERE created_at >= :yesterday
            GROUP BY issue_category
            ORDER BY count DESC
            LIMIT 10
        """), {'yesterday': yesterday}).fetchall()
        
        return {
            "timestamp": datetime.now().isoformat(),
            "realtime": realtime_data,
            "token_usage": {
                "input_tokens": int(token_usage.total_input_tokens or 0),
                "output_tokens": int(token_usage.total_output_tokens or 0),
                "total_tokens": int((token_usage.total_input_tokens or 0) + (token_usage.total_output_tokens or 0)),
                "total_cost": float(token_usage.total_cost or 0)
            },
            "activity": {
                "active_sessions_24h": int(active_sessions.count or 0),
                "active_sessions_now": realtime_data.get('active_sessions', 0),
                "active_users_now": realtime_data.get('active_users', 0)
            },
            "top_agents": [
                {
                    "name": agent.name,
                    "executions": int(agent.executions or 0),
                    "avg_response_time_ms": int(agent.avg_response_time or 0)
                }
                for agent in top_agents
            ],
            "classifications": [
                {
                    "category": cls.issue_category,
                    "count": int(cls.count),
                    "avg_rating": float(cls.avg_rating or 0)
                }
                for cls in recent_classifications
            ],
            "system_health": {
                "redis_connected": metrics_collector.redis_client is not None if metrics_collector else False,
                "workers_running": metrics_collector.running if metrics_collector else False,
                "queue_sizes": realtime_data.get('queue_sizes', {})
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Erro ao obter métricas em tempo real: {e}")
        return {
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
            "system_health": {"status": "error"}
        }
