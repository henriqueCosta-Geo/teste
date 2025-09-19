from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel
import logging
from database import get_db
from analytics_service import AnalyticsService

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
logger = logging.getLogger(__name__)

# ========================================
# SCHEMAS
# ========================================

class FeedbackRequest(BaseModel):
    session_id: str
    message_id: Optional[str] = None
    rating: Optional[int] = None  # 1 (👎) ou 5 (👍)
    comment: Optional[str] = None
    agent_id: Optional[int] = None
    team_id: Optional[int] = None

class DateRangeQuery(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class UserMetricsResponse(BaseModel):
    total_users: int
    total_sessions: int
    current_active_users: int
    max_concurrent_users: int
    average_response_time_seconds: float
    total_messages: int
    average_messages_per_chat: float
    period_start: str
    period_end: str

class TokenMetricsResponse(BaseModel):
    monthly_consumption: int
    daily_average: int
    estimated_end_month: int
    remaining_tokens: int
    monthly_limit: int
    consumption_by_model: dict
    period_start: str
    period_end: str
    will_exceed_limit: bool

class TopicResponse(BaseModel):
    name: str
    mentions: int
    unique_sessions: int
    trend_score: int
    category: str

class FeedbackMetricsResponse(BaseModel):
    total_feedback: int
    average_rating: float
    satisfaction_score: float
    positive_feedback: int
    negative_feedback: int
    neutral_feedback: int
    by_category: dict
    by_sentiment: dict
    period_start: str
    period_end: str

class AgentPerformanceResponse(BaseModel):
    agent_id: int
    agent_name: str
    model: str
    total_interactions: int
    avg_response_time_ms: float
    tokens_consumed: int
    total_input_tokens: int
    total_output_tokens: int
    total_cost: float
    collections_count: int
    success_rate: float
    last_active: Optional[str]

class SystemAlertResponse(BaseModel):
    type: str
    severity: str
    message: str
    category: str
    created_at: str

class UsageTimelineResponse(BaseModel):
    date: str
    sessions: int
    unique_users: int
    period_type: str

# ========================================
# ENDPOINTS
# ========================================

@router.get("/users", response_model=UserMetricsResponse)
async def get_user_metrics(
    start_date: Optional[date] = Query(None, description="Data inicial (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Data final (YYYY-MM-DD)"),
    agent_id: Optional[int] = Query(None, description="Filtrar por agente específico"),
    db: Session = Depends(get_db)
):
    """
    Obter métricas de usuários
    
    - **start_date**: Data inicial do período (padrão: 30 dias atrás)
    - **end_date**: Data final do período (padrão: hoje)
    - **agent_id**: Filtrar métricas por agente específico
    """
    try:
        analytics = AnalyticsService(db)
        metrics = analytics.get_user_metrics(start_date, end_date, agent_id)
        return UserMetricsResponse(**metrics)
    except Exception as e:
        logger.error(f"Erro ao obter métricas de usuários: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/tokens", response_model=TokenMetricsResponse)
async def get_token_metrics(
    start_date: Optional[date] = Query(None, description="Data inicial (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Data final (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    Obter métricas de consumo de tokens
    
    - **start_date**: Data inicial (padrão: início do mês atual)
    - **end_date**: Data final (padrão: hoje)
    """
    try:
        analytics = AnalyticsService(db)
        metrics = analytics.get_token_metrics(start_date, end_date)
        return TokenMetricsResponse(**metrics)
    except Exception as e:
        logger.error(f"Erro ao obter métricas de tokens: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/topics", response_model=List[TopicResponse])
async def get_trending_topics(
    limit: int = Query(10, ge=1, le=50, description="Número máximo de tópicos"),
    days_back: int = Query(7, ge=1, le=90, description="Dias para análise"),
    db: Session = Depends(get_db)
):
    """
    Obter tópicos em alta baseado nas conversas
    
    - **limit**: Número máximo de tópicos a retornar (1-50)
    - **days_back**: Número de dias para análise (1-90)
    """
    try:
        analytics = AnalyticsService(db)
        topics = analytics.get_trending_topics(limit, days_back)
        return [TopicResponse(**topic) for topic in topics]
    except Exception as e:
        logger.error(f"Erro ao obter tópicos em alta: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/feedback", response_model=FeedbackMetricsResponse)
async def get_feedback_metrics(
    start_date: Optional[date] = Query(None, description="Data inicial (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Data final (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    Obter métricas de feedback e satisfação
    
    - **start_date**: Data inicial (padrão: 30 dias atrás)
    - **end_date**: Data final (padrão: hoje)
    """
    try:
        analytics = AnalyticsService(db)
        metrics = analytics.get_feedback_metrics(start_date, end_date)
        return FeedbackMetricsResponse(**metrics)
    except Exception as e:
        logger.error(f"Erro ao obter métricas de feedback: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/agents/performance", response_model=List[AgentPerformanceResponse])
async def get_agent_performance(
    agent_id: Optional[int] = Query(None, description="ID do agente específico"),
    limit: int = Query(10, ge=1, le=50, description="Número máximo de agentes"),
    db: Session = Depends(get_db)
):
    """
    Obter performance individual dos agentes
    
    - **agent_id**: ID do agente específico (opcional)
    - **limit**: Número máximo de agentes a retornar
    """
    try:
        analytics = AnalyticsService(db)
        performance = analytics.get_agent_performance(agent_id, limit)
        return [AgentPerformanceResponse(**perf) for perf in performance]
    except Exception as e:
        logger.error(f"Erro ao obter performance dos agentes: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/alerts", response_model=List[SystemAlertResponse])
async def get_system_alerts(db: Session = Depends(get_db)):
    """
    Obter alertas do sistema baseado nas métricas atuais
    """
    try:
        analytics = AnalyticsService(db)
        alerts = analytics.get_system_alerts()
        return [SystemAlertResponse(**alert) for alert in alerts]
    except Exception as e:
        logger.error(f"Erro ao obter alertas do sistema: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/usage-timeline", response_model=List[UsageTimelineResponse])
async def get_usage_timeline(
    days_back: int = Query(30, ge=1, le=365, description="Dias para análise"),
    granularity: str = Query("day", regex="^(hour|day|week)$", description="Granularidade dos dados"),
    db: Session = Depends(get_db)
):
    """
    Obter dados de uso ao longo do tempo
    
    - **days_back**: Número de dias para análise (1-365)
    - **granularity**: Granularidade dos dados (hour, day, week)
    """
    try:
        analytics = AnalyticsService(db)
        timeline = analytics.get_usage_timeline(days_back, granularity)
        return [UsageTimelineResponse(**data) for data in timeline]
    except Exception as e:
        logger.error(f"Erro ao obter timeline de uso: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/overview")
async def get_dashboard_overview(db: Session = Depends(get_db)):
    """
    Obter resumo geral para o dashboard principal
    """
    try:
        analytics = AnalyticsService(db)
        
        # Carregar todas as métricas principais
        user_metrics = analytics.get_user_metrics()
        token_metrics = analytics.get_token_metrics()
        feedback_metrics = analytics.get_feedback_metrics()
        trending_topics = analytics.get_trending_topics(limit=5)
        alerts = analytics.get_system_alerts()
        
        return {
            "user_metrics": user_metrics,
            "token_metrics": token_metrics,
            "feedback_metrics": feedback_metrics,
            "trending_topics": trending_topics,
            "alerts": alerts,
            "last_updated": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Erro ao obter overview do dashboard: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/stats/summary")
async def get_stats_summary(db: Session = Depends(get_db)):
    """
    Obter estatísticas resumidas do sistema
    """
    try:
        analytics = AnalyticsService(db)
        
        # Métricas básicas
        from agent_models import Agent, ChatSession, ChatMessage, AgentExecution
        
        total_agents = db.query(Agent).filter(Agent.is_active == True).count()
        total_sessions_all_time = db.query(ChatSession).count()
        total_messages_all_time = db.query(ChatMessage).count()
        total_executions = db.query(AgentExecution).count()
        
        # Atividade recente (últimas 24h)
        yesterday = datetime.now() - timedelta(days=1)
        recent_sessions = db.query(ChatSession).filter(ChatSession.created_at >= yesterday).count()
        recent_messages = db.query(ChatMessage).filter(ChatMessage.created_at >= yesterday).count()
        
        return {
            "totals": {
                "agents": total_agents,
                "sessions_all_time": total_sessions_all_time,
                "messages_all_time": total_messages_all_time,
                "executions_all_time": total_executions
            },
            "last_24h": {
                "sessions": recent_sessions,
                "messages": recent_messages,
                "activity_rate": round((recent_sessions / total_sessions_all_time * 100) if total_sessions_all_time > 0 else 0, 1)
            },
            "generated_at": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Erro ao obter resumo de estatísticas: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

# ========================================
# ENDPOINTS PARA EXPORT DE DADOS
# ========================================

@router.get("/export/sessions")
async def export_sessions_data(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    format_type: str = Query("json", regex="^(json|csv)$"),
    db: Session = Depends(get_db)
):
    """
    Exportar dados de sessões em JSON ou CSV
    """
    try:
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()
            
        # Query das sessões
        from agent_models import ChatSession, Agent, AgentTeam
        
        sessions = db.query(
            ChatSession.session_id,
            ChatSession.created_at,
            ChatSession.last_activity,
            Agent.name.label("agent_name"),
            AgentTeam.name.label("team_name")
        ).outerjoin(
            Agent, ChatSession.agent_id == Agent.id
        ).outerjoin(
            AgentTeam, ChatSession.team_id == AgentTeam.id
        ).filter(
            ChatSession.created_at >= start_date,
            ChatSession.created_at <= end_date + timedelta(days=1)
        ).all()
        
        if format_type == "json":
            return {
                "sessions": [
                    {
                        "session_id": s.session_id,
                        "created_at": s.created_at.isoformat() if s.created_at else None,
                        "last_activity": s.last_activity.isoformat() if s.last_activity else None,
                        "agent_name": s.agent_name,
                        "team_name": s.team_name
                    }
                    for s in sessions
                ],
                "total_count": len(sessions),
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                }
            }
        else:  # CSV
            import io
            import csv
            from fastapi.responses import StreamingResponse
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Header
            writer.writerow(["Session ID", "Created At", "Last Activity", "Agent Name", "Team Name"])
            
            # Data
            for s in sessions:
                writer.writerow([
                    s.session_id,
                    s.created_at.isoformat() if s.created_at else "",
                    s.last_activity.isoformat() if s.last_activity else "",
                    s.agent_name or "",
                    s.team_name or ""
                ])
            
            output.seek(0)
            
            return StreamingResponse(
                io.StringIO(output.getvalue()),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=sessions_export.csv"}
            )
            
    except Exception as e:
        logger.error(f"Erro ao exportar dados de sessões: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

# ========================================
# ENDPOINTS PARA FEEDBACK DE USUÁRIOS
# ========================================

@router.post("/feedback/submit")
async def submit_user_feedback(
    request_data: dict,
    db: Session = Depends(get_db)
):
    """
    Endpoint para receber feedback dos usuários (👍/👎)
    """
    try:
        logger.info(f"📝 Feedback recebido - Raw data: {request_data}")
        
        # Extrair dados do dicionário
        session_id = request_data.get('session_id')
        rating = request_data.get('rating')
        agent_id = request_data.get('agent_id')
        team_id = request_data.get('team_id')
        comment = request_data.get('comment')
        message_id = request_data.get('message_id')
        
        logger.info(f"📝 Session ID: {session_id}")
        logger.info(f"📝 Rating: {rating}")
        logger.info(f"📝 Agent ID: {agent_id}")
        logger.info(f"📝 Team ID: {team_id}")
        from agent_models import UserFeedback
        from datetime import datetime
        
        # Determinar sentimento baseado no rating
        sentiment = "positivo" if rating and rating >= 4 else "negativo" if rating and rating <= 2 else "neutro"
        
        # Criar registro de feedback
        feedback = UserFeedback(
            session_id=session_id,
            user_id=f"user_{session_id.split('-')[0]}" if session_id else "unknown",  # Extrair user_id do session_id
            agent_id=agent_id,
            team_id=team_id,
            rating=rating,
            feedback_comment=comment,
            sentiment=sentiment,
            auto_generated=False,
            created_at=datetime.now()
        )
        
        db.add(feedback)
        db.commit()
        
        logger.info(f"📝 Feedback salvo com sucesso - Sessão: {session_id}, Rating: {rating}, Sentimento: {sentiment}")
        
        return {
            "success": True,
            "message": "Feedback registrado com sucesso",
            "feedback_id": feedback.id,
            "sentiment": sentiment
        }
        
    except Exception as e:
        logger.error(f"Erro ao salvar feedback: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/machines/references")
async def get_machine_references(
    days_back: int = Query(30, ge=1, le=90, description="Dias para análise"),
    db: Session = Depends(get_db)
):
    """
    Obter contador de referências por máquina/modelo
    
    - **days_back**: Número de dias para análise (1-90)
    """
    try:
        analytics = AnalyticsService(db)
        machine_stats = analytics.get_machine_references(days_back)
        return machine_stats
    except Exception as e:
        logger.error(f"Erro ao obter estatísticas de máquinas: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")