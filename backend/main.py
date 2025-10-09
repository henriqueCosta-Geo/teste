# main.py — topo do arquivo
import os
import sys
import uuid
import shutil
import logging
from fastapi import FastAPI, Depends, HTTPException, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from dotenv import load_dotenv

# Configurar logging para aparecer no Docker
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Carregar variáveis de ambiente
load_dotenv()

from database import get_db, create_tables, SessionLocal
from models import Collection as CollectionModel, File as FileModel, Chunk as ChunkModel
from schemas import *
from qdrant_service import QdrantService
from file_processor import FileProcessor
from agent_endpoints import agent_router
from teams_endpoints import teams_router
from analytics_endpoints import router as analytics_router
from database_query_endpoints import router as database_query_router
from admin_endpoints import router as admin_router
from chat_endpoints import router as chat_router
# Importar modelos de agentes para que sejam criados pelo create_all()
import agent_models

app = FastAPI(title="Qdrant Admin API", version="1.0.0")  # <-- crie antes de incluir router

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instanciar serviços globais
qdrant_service = QdrantService()
file_processor = FileProcessor()

# Initialize MetricsCollector
metrics_collector = None

# Initialize MongoDB
mongo_service = None

# Startup
@app.on_event("startup")
async def _startup():
    global metrics_collector, mongo_service
    create_tables()
    os.makedirs("/app/uploads", exist_ok=True)

    # Initialize MongoDB
    try:
        from mongo_service import init_mongo, get_mongo_service

        mongo_connected = await init_mongo()
        if mongo_connected:
            mongo_service = get_mongo_service()
            logging.info("✅ MongoDB initialized successfully")
        else:
            logging.warning("⚠️ MongoDB not available - system will continue without it")
            mongo_service = None
    except Exception as e:
        logging.error(f"❌ Failed to initialize MongoDB: {e}")
        mongo_service = None

    # Initialize metrics collection system
    # ⚠️ METRICS COLLECTOR TEMPORARIAMENTE DESABILITADO (problema Redis no Railway)
    try:
        from metrics_collector import MetricsCollector
        import asyncio

        metrics_collector = MetricsCollector()
        redis_ok = await metrics_collector.initialize()

        # Só iniciar workers se Redis estiver OK
        if redis_ok:
            asyncio.create_task(metrics_collector.start_workers())
            logging.info("✅ Metrics collection system and workers initialized")
        else:
            logging.warning("⚠️ Metrics collector disabled - Redis not available")
            metrics_collector = None
    except Exception as e:
        logging.error(f"❌ Failed to initialize metrics collector: {e}")
        metrics_collector = None
    
    # Criar usuários essenciais (admin) primeiro
    try:
        from user_seed import ensure_admin_user, ensure_demo_data
        ensure_admin_user()
        ensure_demo_data()
    except Exception as e:
        logging.error(f"❌ Failed to create admin user: {e}")

    # Criar dados de exemplo se necessário
    try:
        from seed_data import ensure_sample_data
        ensure_sample_data()
    except Exception as e:
        logging.error(f"❌ Failed to create sample data: {e}")

# Shutdown
@app.on_event("shutdown")
async def _shutdown():
    """Fechar conexões ao encerrar aplicação"""
    global mongo_service

    # Fechar MongoDB
    if mongo_service:
        try:
            from mongo_service import close_mongo
            await close_mongo()
            logging.info("✅ MongoDB connection closed")
        except Exception as e:
            logging.error(f"❌ Error closing MongoDB: {e}")

# Inclua os routers depois do app existir
app.include_router(agent_router)
app.include_router(teams_router)
app.include_router(analytics_router)
app.include_router(database_query_router)
app.include_router(admin_router)
app.include_router(chat_router)


@app.get("/collections", response_model=List[CollectionWithStats])
def list_collections(db: Session = Depends(get_db)):
    """Listar todas as coleções"""
    collections = db.query(CollectionModel).all()

    result = []
    for collection in collections:
        files_count = db.query(FileModel).filter(FileModel.collection_id == collection.id).count()
        chunks_count = db.query(ChunkModel).filter(ChunkModel.collection_id == collection.id).count()

        result.append(CollectionWithStats(
            **collection.__dict__,
            files_count=files_count,
            chunks_count=chunks_count
        ))

    return result


@app.post("/collections", response_model=Collection)
def create_collection(collection: CollectionCreate, db: Session = Depends(get_db)):
    """Criar nova coleção"""
    # Verificar se já existe
    existing = db.query(CollectionModel).filter(CollectionModel.name == collection.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Coleção já existe")

    # Criar no Qdrant
    success = qdrant_service.create_collection(
        collection.name,
        collection.vector_size,
        collection.distance_metric
    )

    if not success:
        raise HTTPException(status_code=500, detail="Erro ao criar coleção no Qdrant")

    # Salvar no PostgreSQL
    db_collection = CollectionModel(**collection.dict())
    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)

    return db_collection


@app.get("/collections/{collection_id}")
def get_collection(collection_id: int, db: Session = Depends(get_db)):
    """Obter uma coleção específica"""
    collection = db.query(CollectionModel).filter(CollectionModel.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Coleção não encontrada")

    # Buscar info do Qdrant
    qdrant_info = qdrant_service.get_collection_info(collection.name)

    return {
        **collection.__dict__,
        "qdrant_info": qdrant_info
    }


@app.delete("/collections/{collection_id}")
def delete_collection(collection_id: int, db: Session = Depends(get_db)):
    """Deletar coleção"""
    collection = db.query(CollectionModel).filter(CollectionModel.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Coleção não encontrada")

    # Deletar do Qdrant
    qdrant_service.delete_collection(collection.name)

    # Deletar chunks e arquivos relacionados
    db.query(ChunkModel).filter(ChunkModel.collection_id == collection_id).delete()
    db.query(FileModel).filter(FileModel.collection_id == collection_id).delete()

    # Deletar coleção
    db.delete(collection)
    db.commit()

    return {"message": "Coleção deletada com sucesso"}


# ROTAS DE ARQUIVOS

@app.post("/collections/{collection_id}/upload")
async def upload_file(
        collection_id: int,
        file: UploadFile,
        db: Session = Depends(get_db)
):
    """Upload de arquivo para uma coleção"""
    # Verificar se coleção existe
    collection = db.query(CollectionModel).filter(CollectionModel.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Coleção não encontrada")

    # Validar tipo de arquivo - AGORA INCLUINDO MARKDOWN
    allowed_types = ['pdf', 'txt', 'docx', 'md']
    file_extension = file.filename.split('.')[-1].lower()
    if file_extension not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Tipo de arquivo não suportado. Use: {', '.join(allowed_types)}")

    # Salvar arquivo
    file_id = str(uuid.uuid4())
    filename = f"{file_id}.{file_extension}"
    file_path = f"/app/uploads/{filename}"

    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    # Salvar no banco
    db_file = FileModel(
        filename=filename,
        original_name=file.filename,
        file_path=file_path,
        file_type=file_extension,
        file_size=len(content),
        collection_id=collection_id
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    return {"message": "Arquivo enviado com sucesso", "file_id": db_file.id}


@app.post("/files/{file_id}/process")
def process_file(
        file_id: int,
        chunk_size: int = Form(default=1000),
        chunk_overlap: int = Form(default=100),
        db: Session = Depends(get_db)
):
    """Processar arquivo: extrair texto, criar chunks e embeddings"""
    file_record = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    collection = db.query(CollectionModel).filter(CollectionModel.id == file_record.collection_id).first()

    try:
        # Extrair texto
        text = file_processor.extract_text_from_file(file_record.file_path, file_record.file_type)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Não foi possível extrair texto do arquivo")

        # Criar chunks com algoritmo melhorado
        chunks = file_processor.create_chunks(text, chunk_size, chunk_overlap)
        if not chunks:
            raise HTTPException(status_code=400, detail="Não foi possível criar chunks do texto")

        # Preparar dados para Qdrant
        chunks_data = []
        for i, chunk_content in enumerate(chunks):
            chunks_data.append({
                'content': chunk_content,
                'file_id': file_id,
                'chunk_index': i,
                'file_name': file_record.original_name
            })

        # Adicionar ao Qdrant
        success = qdrant_service.add_chunks_to_collection(collection.name, chunks_data)
        if not success:
            raise HTTPException(status_code=500, detail="Erro ao processar chunks no Qdrant")

        # Salvar chunks no banco
        for chunk_data in chunks_data:
            db_chunk = ChunkModel(
                file_id=file_id,
                collection_id=file_record.collection_id,
                content=chunk_data['content'],
                chunk_index=chunk_data['chunk_index'],
                qdrant_point_id=chunk_data['qdrant_point_id']
            )
            db.add(db_chunk)

        # Marcar arquivo como processado
        file_record.processed = True
        db.commit()

        # Obter estatísticas dos chunks
        chunk_stats = file_processor.get_chunk_stats(chunks)

        return {
            "message": "Arquivo processado com sucesso",
            "chunks_created": len(chunks),
            "chunk_stats": chunk_stats
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo: {str(e)}")


@app.get("/files/{file_id}/preview")
def get_file_preview(file_id: int, db: Session = Depends(get_db)):
    """Obter preview do arquivo original e chunks processados"""
    file_record = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    try:
        # Extrair texto original
        original_text = file_processor.extract_text_from_file(file_record.file_path, file_record.file_type)

        # Buscar chunks do banco de dados
        chunks = db.query(ChunkModel).filter(
            ChunkModel.file_id == file_id
        ).order_by(ChunkModel.chunk_index).all()

        # Preparar dados dos chunks
        chunks_data = []
        for chunk in chunks:
            chunks_data.append({
                "index": chunk.chunk_index,
                "content": chunk.content,
                "length": len(chunk.content),
                "qdrant_point_id": chunk.qdrant_point_id
            })

        # Estatísticas do texto original
        original_stats = {
            "length": len(original_text),
            "lines": len(original_text.split('\n')),
            "words": len(original_text.split()),
            "paragraphs": len([p for p in original_text.split('\n\n') if p.strip()])
        }

        # Estatísticas dos chunks
        if chunks_data:
            chunk_lengths = [chunk["length"] for chunk in chunks_data]
            chunk_stats = {
                "total_chunks": len(chunks_data),
                "avg_length": sum(chunk_lengths) // len(chunk_lengths) if chunk_lengths else 0,
                "min_length": min(chunk_lengths) if chunk_lengths else 0,
                "max_length": max(chunk_lengths) if chunk_lengths else 0
            }
        else:
            chunk_stats = {
                "total_chunks": 0,
                "avg_length": 0,
                "min_length": 0,
                "max_length": 0
            }

        return {
            "file_info": {
                "id": file_record.id,
                "original_name": file_record.original_name,
                "file_type": file_record.file_type,
                "file_size": file_record.file_size,
                "processed": file_record.processed
            },
            "original_content": {
                "text": original_text,
                "preview": file_processor.get_text_preview(original_text, 500),
                "stats": original_stats
            },
            "chunks": chunks_data,
            "chunk_stats": chunk_stats
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao obter preview: {str(e)}")


@app.get("/collections/{collection_id}/files", response_model=List[File])
def list_files(collection_id: int, db: Session = Depends(get_db)):
    """Listar arquivos de uma coleção"""
    files = db.query(FileModel).filter(FileModel.collection_id == collection_id).all()
    return files


@app.delete("/files/{file_id}")
def delete_file(file_id: int, db: Session = Depends(get_db)):
    """Deletar arquivo e seus chunks"""
    file_record = db.query(FileModel).filter(FileModel.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    collection = db.query(CollectionModel).filter(CollectionModel.id == file_record.collection_id).first()

    # Deletar pontos do Qdrant
    qdrant_service.delete_points_by_file(collection.name, file_id)

    # Deletar chunks do banco
    db.query(ChunkModel).filter(ChunkModel.file_id == file_id).delete()

    # Deletar arquivo físico
    if os.path.exists(file_record.file_path):
        os.remove(file_record.file_path)

    # Deletar registro do banco
    db.delete(file_record)
    db.commit()

    return {"message": "Arquivo deletado com sucesso"}


# ROTAS DE BUSCA

@app.post("/collections/{collection_id}/search")
def search_collection(
        collection_id: int,
        query: str = Form(...),
        limit: int = Form(default=5),
        db: Session = Depends(get_db)
):
    """Buscar na coleção"""
    collection = db.query(CollectionModel).filter(CollectionModel.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Coleção não encontrada")

    results = qdrant_service.search_similar_chunks(collection.name, query, limit)

    return {
        "query": query,
        "collection": collection.name,
        "results": results
    }


# ROTAS DE STATUS

@app.get("/status")
def get_status():
    """Status geral do sistema"""
    try:
        qdrant_collections = qdrant_service.list_collections()
        metrics_status = "enabled" if metrics_collector else "disabled"
        
        return {
            "status": "online",
            "qdrant_connected": len(qdrant_collections) >= 0,
            "qdrant_collections": qdrant_collections,
            "metrics_system": metrics_status,
            "redis_connected": metrics_collector.redis_client is not None if metrics_collector else False
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "metrics_system": "error" if metrics_collector else "disabled"
        }


@app.post("/sync/collections")
def sync_collections_from_qdrant(db: Session = Depends(get_db)):
    """Sincronização completa entre Qdrant e PostgreSQL"""
    try:
        # Obter coleções do Qdrant
        qdrant_collections = qdrant_service.list_collections()
        qdrant_set = set(qdrant_collections)
        
        # Obter coleções do PostgreSQL
        pg_collections = db.query(CollectionModel).all()
        pg_set = set(col.name for col in pg_collections)
        
        synced_count = 0
        removed_count = 0
        skipped_count = 0
        
        # 1. Adicionar coleções que estão no Qdrant mas não no PostgreSQL
        for collection_name in qdrant_collections:
            if collection_name in pg_set:
                skipped_count += 1
                continue
            
            # Obter informações detalhadas do Qdrant
            qdrant_info = qdrant_service.get_collection_info(collection_name)
            
            # Tentar inferir configurações padrão
            vector_size = 384  # Padrão
            distance_metric = "Cosine"  # Padrão
            
            # Se conseguir obter do Qdrant, usar os valores reais
            if qdrant_info and qdrant_info.get('config'):
                config = qdrant_info['config']
                if 'params' in config and 'vectors' in config['params']:
                    vector_config = config['params']['vectors']
                    if isinstance(vector_config, dict) and 'size' in vector_config:
                        vector_size = vector_config['size']
                    if isinstance(vector_config, dict) and 'distance' in vector_config:
                        distance_metric = vector_config['distance']
            
            # Criar registro no PostgreSQL
            db_collection = CollectionModel(
                name=collection_name,
                description=f"Coleção sincronizada do Qdrant - {qdrant_info.get('points_count', 0)} pontos",
                vector_size=vector_size,
                distance_metric=distance_metric
            )
            
            db.add(db_collection)
            synced_count += 1
        
        # 2. Remover coleções que estão no PostgreSQL mas não no Qdrant
        collections_to_remove = pg_set - qdrant_set
        
        for collection_name in collections_to_remove:
            # Buscar coleção no PostgreSQL
            collection_to_delete = db.query(CollectionModel).filter(
                CollectionModel.name == collection_name
            ).first()
            
            if collection_to_delete:
                # Deletar chunks e arquivos relacionados
                db.query(ChunkModel).filter(
                    ChunkModel.collection_id == collection_to_delete.id
                ).delete()
                db.query(FileModel).filter(
                    FileModel.collection_id == collection_to_delete.id
                ).delete()
                
                # Deletar a coleção
                db.delete(collection_to_delete)
                removed_count += 1
        
        db.commit()
        
        return {
            "message": "Sincronização completa realizada",
            "synced_collections": synced_count,
            "removed_collections": removed_count, 
            "skipped_collections": skipped_count,
            "total_qdrant_collections": len(qdrant_collections),
            "collections": qdrant_collections,
            "removed": list(collections_to_remove)
        }
        
    except Exception as e:
        db.rollback()
        return {
            "error": f"Erro na sincronização: {str(e)}",
            "message": "Falha na sincronização"
        }


@app.get("/")
def root():
    return {"message": "Qdrant Admin API", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)