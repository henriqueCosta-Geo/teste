from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Float, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

Base = declarative_base()


class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    vector_size = Column(Integer, default=384)
    distance_metric = Column(String, default="Cosine")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relacionamentos
    files = relationship("File", back_populates="collection")
    chunks = relationship("Chunk", back_populates="collection")


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer)
    collection_id = Column(Integer, ForeignKey("collections.id"))
    processed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamentos
    collection = relationship("Collection", back_populates="files")
    chunks = relationship("Chunk", back_populates="file")


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"))
    collection_id = Column(Integer, ForeignKey("collections.id"))
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer)
    qdrant_point_id = Column(String)  # ID do ponto no Qdrant
    embedding_model = Column(String, default="all-MiniLM-L6-v2")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamentos
    file = relationship("File", back_populates="chunks")
    collection = relationship("Collection", back_populates="chunks")