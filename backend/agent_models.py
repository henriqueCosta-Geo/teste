from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Float, Boolean, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from models import Base


class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    role = Column(Text)
    model = Column(String(100), default='gpt-4o-mini')
    temperature = Column(Float, default=0.7)
    instructions = Column(Text)
    tools_config = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relacionamentos
    collections = relationship("AgentCollection", back_populates="agent")
    executions = relationship("AgentExecution", back_populates="agent")
    team_memberships = relationship("TeamMember", back_populates="agent")
    led_teams = relationship("AgentTeam", back_populates="leader")


class AgentTeam(Base):
    __tablename__ = "agent_teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    leader_agent_id = Column(Integer, ForeignKey("agents.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamentos
    leader = relationship("Agent", back_populates="led_teams")
    members = relationship("TeamMember", back_populates="team")


class TeamMember(Base):
    __tablename__ = "team_members"

    team_id = Column(Integer, ForeignKey("agent_teams.id", ondelete="CASCADE"), primary_key=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True)
    role_in_team = Column(String(100))

    # Relacionamentos
    team = relationship("AgentTeam", back_populates="members")
    agent = relationship("Agent", back_populates="team_memberships")


class AgentCollection(Base):
    __tablename__ = "agent_collections"

    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True)
    access_level = Column(String(50), default='read')  # 'read', 'write', 'admin'
    priority = Column(Integer, default=0)

    # Relacionamentos
    agent = relationship("Agent", back_populates="collections")
    collection = relationship("Collection")


class AgentSession(Base):
    __tablename__ = "agent_sessions"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"))
    team_id = Column(Integer, ForeignKey("agent_teams.id"))
    user_id = Column(String(255))
    session_data = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True))

    # Relacionamentos
    agent = relationship("Agent")
    team = relationship("AgentTeam")
    executions = relationship("AgentExecution", back_populates="session")


class AgentExecution(Base):
    __tablename__ = "agent_executions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("agent_sessions.id"))
    agent_id = Column(Integer, ForeignKey("agents.id"))
    input_text = Column(Text)
    output_text = Column(Text)
    tools_used = Column(JSON)
    collections_searched = Column(JSON)
    execution_time_ms = Column(Integer)
    tokens_used = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamentos
    session = relationship("AgentSession", back_populates="executions")
    agent = relationship("Agent", back_populates="executions")


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(255), unique=True, index=True)  # UUID do frontend
    team_id = Column(Integer, ForeignKey("agent_teams.id"), nullable=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_activity = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relacionamentos
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    team = relationship("AgentTeam")
    agent = relationship("Agent")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"))
    message_type = Column(String(50))  # 'user', 'team', 'agent', 'error'
    content = Column(Text)
    message_metadata = Column(JSON, default=dict)  # Para armazenar info adicional
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relacionamentos
    session = relationship("ChatSession", back_populates="messages")


# ===============================
# MODELOS PARA SISTEMA DE MÉTRICAS
# ===============================

class TokenUsage(Base):
    """Tabela para armazenar consumo de tokens e custos"""
    __tablename__ = "token_usage"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    session_id = Column(String(255), index=True)
    model_used = Column(String(100), nullable=False)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    cost_estimate = Column(Float, default=0.0)
    operation_type = Column(String(50), default='chat')  # 'chat', 'rag', 'classification'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relacionamentos
    agent = relationship("Agent")


class UserMetrics(Base):
    """Tabela para métricas de usuários e sessões"""
    __tablename__ = "user_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    session_id = Column(String(255), nullable=False, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    team_id = Column(Integer, ForeignKey("agent_teams.id"), nullable=True)
    total_messages = Column(Integer, default=0)
    session_duration_seconds = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relacionamentos
    agent = relationship("Agent")
    team = relationship("AgentTeam")
    
    # Constraint único para user_id + session_id
    __table_args__ = (
        UniqueConstraint('user_id', 'session_id', name='unique_user_session'),
    )


class PerformanceMetrics(Base):
    """Tabela para métricas de performance dos agentes"""
    __tablename__ = "performance_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    metric_date = Column(DateTime(timezone=True), nullable=False, index=True)
    total_interactions = Column(Integer, default=0)
    avg_response_time_ms = Column(Float, default=0.0)
    tokens_consumed = Column(Integer, default=0)
    success_rate = Column(Float, default=100.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relacionamentos
    agent = relationship("Agent")
    
    # Constraint único para agent_id + metric_date
    __table_args__ = (
        UniqueConstraint('agent_id', 'metric_date', name='unique_agent_metric_date'),
    )


class ContentTopics(Base):
    """Tabela para análise de conteúdo e tópicos extraídos"""
    __tablename__ = "content_topics"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(255), nullable=False, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    extracted_topics = Column(JSON, default=list)  # Lista de tópicos encontrados
    message_content = Column(Text, nullable=True)  # Conteúdo da mensagem (truncado)
    topic_keywords = Column(JSON, default=list)  # Palavras-chave extraídas
    confidence_score = Column(Float, default=0.0)  # Confiança da extração
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relacionamentos
    agent = relationship("Agent")


class UserFeedback(Base):
    """Tabela para feedback dos usuários e classificações automáticas"""
    __tablename__ = "user_feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(255), nullable=False, index=True)
    user_id = Column(String(255), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    team_id = Column(Integer, ForeignKey("agent_teams.id"), nullable=True)
    rating = Column(Integer, nullable=True)  # 1-5
    issue_category = Column(String(100), nullable=True)  # Categoria do problema
    feedback_comment = Column(Text, nullable=True)  # Comentário ou resumo
    sentiment = Column(String(50), nullable=True)  # 'positivo', 'negativo', 'neutro'
    auto_generated = Column(Boolean, default=False)  # Se foi gerado automaticamente
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relacionamentos
    agent = relationship("Agent")
    team = relationship("AgentTeam")
