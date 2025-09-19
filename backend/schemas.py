from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime


# Collection Schemas
class CollectionBase(BaseModel):
    name: str
    description: Optional[str] = None
    vector_size: int = 384
    distance_metric: str = "Cosine"


class CollectionCreate(CollectionBase):
    pass


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class Collection(CollectionBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# File Schemas
class FileBase(BaseModel):
    filename: str
    original_name: str
    file_type: str
    file_size: int


class FileCreate(FileBase):
    file_path: str
    collection_id: int


class File(FileBase):
    id: int
    file_path: str
    collection_id: int
    processed: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Chunk Schemas
class ChunkBase(BaseModel):
    content: str
    chunk_index: int


class ChunkCreate(ChunkBase):
    file_id: int
    collection_id: int
    qdrant_point_id: str
    embedding_model: str = "all-MiniLM-L6-v2"


class Chunk(ChunkBase):
    id: int
    file_id: int
    collection_id: int
    qdrant_point_id: str
    embedding_model: str
    created_at: datetime

    class Config:
        from_attributes = True


# Preview Schemas
class FileInfo(BaseModel):
    id: int
    original_name: str
    file_type: str
    file_size: int
    processed: bool


class OriginalContentStats(BaseModel):
    length: int
    lines: int
    words: int
    paragraphs: int


class OriginalContent(BaseModel):
    text: str
    preview: str
    stats: OriginalContentStats


class ChunkPreview(BaseModel):
    index: int
    content: str
    length: int
    qdrant_point_id: str


class ChunkStats(BaseModel):
    total_chunks: int
    avg_length: int
    min_length: int
    max_length: int


class FilePreview(BaseModel):
    file_info: FileInfo
    original_content: OriginalContent
    chunks: List[ChunkPreview]
    chunk_stats: ChunkStats


# Response Schemas
class CollectionWithStats(Collection):
    files_count: int
    chunks_count: int


class SearchResult(BaseModel):
    chunk_id: int
    content: str
    score: float
    file_name: str
    collection_name: str


class ProcessingStats(BaseModel):
    total_chunks: int
    avg_chunk_size: int
    min_chunk_size: int
    max_chunk_size: int
    total_characters: int


class ProcessingResult(BaseModel):
    message: str
    chunks_created: int
    chunk_stats: ProcessingStats