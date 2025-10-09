"""
Endpoints para operações de chat e feedback
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chats", tags=["chats"])


class FeedbackRequest(BaseModel):
    rating: int  # 1 = thumbs down, 5 = thumbs up
    comment: Optional[str] = None
    created_at: str
    user_id: int


@router.post("/{chat_id}/messages/{message_id}/feedback")
async def save_message_feedback(
    chat_id: str,
    message_id: str,
    feedback: FeedbackRequest
):
    """
    Salvar feedback de uma mensagem no MongoDB

    Args:
        chat_id: ID da sessão de chat
        message_id: ID da mensagem específica
        feedback: Dados do feedback (rating, comment, user_id)

    Returns:
        Confirmação de sucesso
    """
    try:
        # Importar serviço MongoDB
        from mongo_service import get_mongo_service
        from mongo_chat_service import MongoChatService

        mongo_service = get_mongo_service()

        if not mongo_service or not mongo_service.is_connected:
            logger.error("❌ MongoDB não disponível")
            raise HTTPException(
                status_code=503,
                detail="MongoDB não disponível. Não é possível salvar feedback."
            )

        # Criar instância do serviço de chat
        chat_service = MongoChatService(mongo_service)

        # Validar rating
        if feedback.rating not in [1, 5]:
            raise HTTPException(
                status_code=400,
                detail="Rating inválido. Use 1 (negativo) ou 5 (positivo)"
            )

        # Preparar dados do feedback
        feedback_data = {
            "rating": feedback.rating,
            "created_at": datetime.fromisoformat(feedback.created_at.replace('Z', '+00:00')),
            "user_id": feedback.user_id
        }

        if feedback.comment:
            feedback_data["comment"] = feedback.comment

        # Salvar no MongoDB
        logger.info(f"💾 Salvando feedback para chat {chat_id}, mensagem {message_id}")
        logger.info(f"   Rating: {feedback.rating}, User: {feedback.user_id}")

        success = await chat_service.update_message_feedback(
            chat_id=chat_id,
            message_id=message_id,
            feedback=feedback_data
        )

        if not success:
            logger.error(f"❌ Falha ao salvar feedback - chat ou mensagem não encontrados")
            raise HTTPException(
                status_code=404,
                detail="Chat ou mensagem não encontrada"
            )

        logger.info(f"✅ Feedback salvo com sucesso")

        return {
            "success": True,
            "message": "Feedback salvo com sucesso",
            "chat_id": chat_id,
            "message_id": message_id,
            "rating": feedback.rating
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao salvar feedback: {e}")
        logger.exception(e)
        raise HTTPException(
            status_code=500,
            detail=f"Erro interno ao salvar feedback: {str(e)}"
        )


@router.get("/{chat_id}")
async def get_chat_with_messages(chat_id: str):
    """
    Buscar chat completo com todas as mensagens

    Args:
        chat_id: ID da sessão de chat

    Returns:
        Chat completo com mensagens
    """
    try:
        from mongo_service import get_mongo_service
        from mongo_chat_service import MongoChatService

        mongo_service = get_mongo_service()

        if not mongo_service or not mongo_service.is_connected:
            raise HTTPException(
                status_code=503,
                detail="MongoDB não disponível"
            )

        chat_service = MongoChatService(mongo_service)

        chat = await chat_service.get_chat_with_messages(chat_id)

        if not chat:
            raise HTTPException(
                status_code=404,
                detail="Chat não encontrado"
            )

        # Converter ObjectId para string para serialização JSON
        if '_id' in chat:
            chat['_id'] = str(chat['_id'])

        return chat

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar chat: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro interno ao buscar chat: {str(e)}"
        )
