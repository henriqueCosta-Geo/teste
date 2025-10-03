"""
Endpoints para executar queries SQL customizadas no PostgreSQL
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, validator
from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/database", tags=["database"])


class QueryRequest(BaseModel):
    """Request para executar query SQL"""
    query: str
    params: Optional[Dict[str, Any]] = None

    @validator('query')
    def validate_query(cls, v):
        """Validar query para evitar comandos perigosos"""
        v = v.strip().upper()

        # Lista de comandos proibidos (apenas permitir SELECT por segurança)
        dangerous_keywords = [
            'DROP', 'DELETE', 'TRUNCATE', 'ALTER',
            'CREATE', 'INSERT', 'UPDATE', 'GRANT', 'REVOKE'
        ]

        for keyword in dangerous_keywords:
            if keyword in v:
                raise ValueError(
                    f"Comando {keyword} não permitido. Use apenas queries SELECT para leitura."
                )

        if not v.startswith('SELECT'):
            raise ValueError("Apenas queries SELECT são permitidas")

        return v


class QueryResult(BaseModel):
    """Resultado da execução de query"""
    columns: List[str]
    rows: List[Dict[str, Any]]
    row_count: int
    execution_time_ms: Optional[float] = None


class TableInfo(BaseModel):
    """Informações sobre uma tabela"""
    table_name: str
    column_count: int
    row_count: Optional[int] = None


class TableSchema(BaseModel):
    """Schema detalhado de uma tabela"""
    table_name: str
    columns: List[Dict[str, Any]]


@router.post("/query", response_model=QueryResult)
async def execute_query(
    request: QueryRequest,
    db: Session = Depends(get_db)
):
    """
    Executar uma query SQL SELECT customizada

    Apenas queries SELECT são permitidas por questões de segurança.
    Para modificar dados, use os endpoints específicos da API.
    """
    try:
        import time
        start_time = time.time()

        # Executar query
        result = db.execute(text(request.query), request.params or {})

        # Obter nomes das colunas
        columns = list(result.keys())

        # Converter resultados para lista de dicionários
        rows = []
        for row in result:
            row_dict = {}
            for i, col in enumerate(columns):
                value = row[i]
                # Converter tipos especiais para JSON serializável
                if hasattr(value, 'isoformat'):
                    value = value.isoformat()
                row_dict[col] = value
            rows.append(row_dict)

        execution_time = (time.time() - start_time) * 1000  # em ms

        return QueryResult(
            columns=columns,
            rows=rows,
            row_count=len(rows),
            execution_time_ms=round(execution_time, 2)
        )

    except Exception as e:
        logger.error(f"Erro ao executar query: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Erro ao executar query: {str(e)}"
        )


@router.get("/tables", response_model=List[TableInfo])
async def list_tables(db: Session = Depends(get_db)):
    """
    Listar todas as tabelas do banco de dados PostgreSQL
    """
    try:
        # Query para obter todas as tabelas do schema public
        query = text("""
            SELECT
                table_name,
                (
                    SELECT COUNT(*)
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = t.table_name
                ) as column_count
            FROM information_schema.tables t
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)

        result = db.execute(query)

        tables = []
        for row in result:
            tables.append(TableInfo(
                table_name=row[0],
                column_count=row[1]
            ))

        return tables

    except Exception as e:
        logger.error(f"Erro ao listar tabelas: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao listar tabelas: {str(e)}"
        )


@router.get("/tables/{table_name}/schema", response_model=TableSchema)
async def get_table_schema(table_name: str, db: Session = Depends(get_db)):
    """
    Obter schema detalhado de uma tabela específica
    """
    try:
        # Query para obter informações das colunas
        query = text("""
            SELECT
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = :table_name
            ORDER BY ordinal_position
        """)

        result = db.execute(query, {"table_name": table_name})

        columns = []
        for row in result:
            col_info = {
                "name": row[0],
                "type": row[1],
                "max_length": row[2],
                "nullable": row[3] == 'YES',
                "default": row[4]
            }
            columns.append(col_info)

        if not columns:
            raise HTTPException(
                status_code=404,
                detail=f"Tabela '{table_name}' não encontrada"
            )

        return TableSchema(
            table_name=table_name,
            columns=columns
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter schema da tabela: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao obter schema: {str(e)}"
        )


@router.get("/tables/{table_name}/count")
async def get_table_row_count(table_name: str, db: Session = Depends(get_db)):
    """
    Obter contagem de linhas de uma tabela
    """
    try:
        # Validar nome da tabela (prevenir SQL injection)
        if not table_name.replace('_', '').isalnum():
            raise HTTPException(
                status_code=400,
                detail="Nome de tabela inválido"
            )

        query = text(f"SELECT COUNT(*) FROM {table_name}")
        result = db.execute(query)
        count = result.scalar()

        return {"table_name": table_name, "row_count": count}

    except Exception as e:
        logger.error(f"Erro ao contar linhas: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao contar linhas: {str(e)}"
        )


@router.get("/tables/{table_name}/preview")
async def preview_table(
    table_name: str,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    Obter preview dos dados de uma tabela com paginação
    """
    try:
        # Validar nome da tabela
        if not table_name.replace('_', '').isalnum():
            raise HTTPException(
                status_code=400,
                detail="Nome de tabela inválido"
            )

        # Limitar o limit máximo
        limit = min(limit, 1000)

        # Query para obter dados
        query = text(f"""
            SELECT * FROM {table_name}
            ORDER BY 1
            LIMIT :limit OFFSET :offset
        """)

        result = db.execute(query, {"limit": limit, "offset": offset})

        # Obter nomes das colunas
        columns = list(result.keys())

        # Converter resultados
        rows = []
        for row in result:
            row_dict = {}
            for i, col in enumerate(columns):
                value = row[i]
                if hasattr(value, 'isoformat'):
                    value = value.isoformat()
                row_dict[col] = value
            rows.append(row_dict)

        # Obter total de linhas
        count_query = text(f"SELECT COUNT(*) FROM {table_name}")
        total_rows = db.execute(count_query).scalar()

        return {
            "table_name": table_name,
            "columns": columns,
            "rows": rows,
            "total_rows": total_rows,
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        logger.error(f"Erro ao obter preview: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao obter preview: {str(e)}"
        )
