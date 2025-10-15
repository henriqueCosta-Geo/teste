import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base

# Railway configura DATABASE_URL automaticamente
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

engine = create_engine(
    DATABASE_URL,
    pool_size=10,           # Aumentar pool base de 5 para 10
    max_overflow=20,        # Aumentar overflow de 10 para 20
    pool_pre_ping=True,     # Verificar conexões antes de usar
    pool_recycle=3600,      # Reciclar conexões a cada 1h
    echo=False              # Desabilitar logs SQL para performance
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_tables():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()