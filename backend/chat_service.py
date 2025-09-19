"""
Serviço para gerenciamento de sessões de chat e histórico de mensagens
"""

from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import uuid
import logging

from agent_models import ChatSession, ChatMessage

logger = logging.getLogger(__name__)


class ChatService:
    """Serviço para gerenciar sessões de chat e histórico"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_or_create_session(self, session_id: str, team_id: Optional[int] = None, agent_id: Optional[int] = None) -> ChatSession:
        """Obtém ou cria uma sessão de chat"""
        session = self.db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        
        if not session:
            logger.info(f"🆕 [CHAT] CRIANDO NOVA SESSÃO: {session_id} - Team: {team_id}, Agent: {agent_id}")
            session = ChatSession(
                session_id=session_id,
                team_id=team_id,
                agent_id=agent_id
            )
            self.db.add(session)
            self.db.commit()
            self.db.refresh(session)
        else:
            logger.info(f"📝 [CHAT] SESSÃO EXISTENTE: {session_id} - Atualizando atividade")
            # Atualizar última atividade
            session.last_activity = datetime.now()
            self.db.commit()
        
        return session
    
    def add_message(self, session_id: str, message_type: str, content: str, metadata: Optional[Dict] = None) -> ChatMessage:
        """Adiciona uma mensagem ao histórico"""
        session = self.get_or_create_session(session_id)
        
        # Determinar quem está enviando a mensagem
        sender_info = "unknown"
        if metadata:
            sender_info = metadata.get('sender', message_type)
        elif message_type == 'user':
            sender_info = "usuário"
        elif message_type == 'team':
            sender_info = f"time-{session.team_id}" if session.team_id else "time"
        elif message_type == 'agent':
            sender_info = f"agente-{session.agent_id}" if session.agent_id else "agente"
        
        logger.info(f"💬 [CHAT-{session_id}] [{message_type.upper()}] {sender_info}: {content[:100]}...")
        if metadata:
            logger.info(f"📋 [CHAT-{session_id}] METADATA: {metadata}")
        
        message = ChatMessage(
            session_id=session.id,
            message_type=message_type,
            content=content,
            message_metadata=metadata or {}
        )
        
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        
        logger.info(f"✅ [CHAT-{session_id}] MENSAGEM SALVA: ID {message.id}")
        
        return message
    
    def get_chat_history(self, session_id: str, limit: int = 20) -> List[ChatMessage]:
        """Obtém o histórico de mensagens de uma sessão"""
        session = self.db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        
        if not session:
            return []
        
        messages = self.db.query(ChatMessage).filter(
            ChatMessage.session_id == session.id
        ).order_by(ChatMessage.created_at.asc()).limit(limit).all()
        
        return messages
    
    def get_context_for_agent(self, session_id: str, max_messages: int = 10) -> List[Dict]:
        """Obtém contexto formatado para enviar ao agente"""
        messages = self.get_chat_history(session_id, max_messages)
        
        context = []
        for msg in messages:
            context.append({
                "type": msg.message_type,
                "content": msg.content,
                "timestamp": msg.created_at.isoformat(),
                "metadata": msg.message_metadata
            })
        
        return context
    
    def cleanup_old_sessions(self, hours_old: int = 24):
        """Remove sessões antigas (limpeza automática)"""
        cutoff_time = datetime.now() - timedelta(hours=hours_old)
        
        old_sessions = self.db.query(ChatSession).filter(
            ChatSession.last_activity < cutoff_time
        ).all()
        
        for session in old_sessions:
            self.db.delete(session)
        
        self.db.commit()
        
        return len(old_sessions)