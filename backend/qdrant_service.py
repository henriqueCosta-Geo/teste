import os
import uuid
import hashlib
from typing import List, Dict, Any
from qdrant_client import QdrantClient, models


class QdrantService:
    def __init__(self):
        self.client = QdrantClient(
            url=os.getenv("QDRANT_URL"),
            api_key=os.getenv("QDRANT_API_KEY")
        )

    def create_collection(self, collection_name: str, vector_size: int = 384, distance_metric: str = "Cosine"):
        """Criar uma nova coleção no Qdrant"""
        try:
            distance = getattr(models.Distance, distance_metric.upper())

            self.client.recreate_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=vector_size,
                    distance=distance
                )
            )
            return True
        except Exception as e:
            print(f"Erro ao criar coleção: {e}")
            return False

    def delete_collection(self, collection_name: str):
        """Deletar uma coleção do Qdrant"""
        try:
            self.client.delete_collection(collection_name)
            return True
        except Exception as e:
            print(f"Erro ao deletar coleção: {e}")
            return False

    def list_collections(self):
        """Listar todas as coleções"""
        try:
            collections = self.client.get_collections()
            return [col.name for col in collections.collections]
        except Exception as e:
            print(f"Erro ao listar coleções: {e}")
            return []

    def get_collection_info(self, collection_name: str):
        """Obter informações de uma coleção"""
        try:
            info = self.client.get_collection(collection_name)
            return {
                "name": collection_name,
                "vectors_count": info.vectors_count,
                "points_count": info.points_count,
                "config": info.config.dict() if info.config else {}
            }
        except Exception as e:
            print(f"Erro ao obter info da coleção: {e}")
            return None

    def generate_simple_embedding(self, text: str, vector_size: int = 384) -> List[float]:
        """Gerar embedding simples usando hash do texto"""
        try:
            # Usar hash SHA-256 do texto
            hash_object = hashlib.sha256(text.encode('utf-8'))
            hex_dig = hash_object.hexdigest()

            # Converter hash em vetor numérico
            vector = []

            # Usar cada par de caracteres hex como um número
            for i in range(0, len(hex_dig), 2):
                byte_val = int(hex_dig[i:i + 2], 16)
                # Normalizar entre -1 e 1
                normalized_val = (byte_val - 128) / 128.0
                vector.append(normalized_val)

            # Expandir ou cortar para o tamanho desejado
            while len(vector) < vector_size:
                # Repetir o padrão se necessário
                remaining = vector_size - len(vector)
                vector.extend(vector[:min(remaining, len(vector))])

            # Garantir que temos exatamente o tamanho correto
            return vector[:vector_size]

        except Exception as e:
            print(f"Erro ao gerar embedding: {e}")
            # Retornar vetor de zeros como fallback
            return [0.0] * vector_size

    def generate_embedding(self, text: str) -> List[float]:
        """Gerar embedding para um texto"""
        return self.generate_simple_embedding(text, 384)

    def add_chunks_to_collection(self, collection_name: str, chunks_data: List[Dict[str, Any]]):
        """Adicionar chunks à coleção com embeddings"""
        try:
            points = []
            for chunk_data in chunks_data:
                # Gerar embedding simples
                embedding = self.generate_embedding(chunk_data['content'])

                # Criar ponto único
                point_id = str(uuid.uuid4())

                point = models.PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={
                        "content": chunk_data['content'],
                        "file_id": chunk_data['file_id'],
                        "chunk_index": chunk_data['chunk_index'],
                        "file_name": chunk_data.get('file_name', ''),
                        "chunk_id": chunk_data.get('chunk_id')
                    }
                )
                points.append(point)
                chunk_data['qdrant_point_id'] = point_id

            # Upload em lotes
            self.client.upsert(
                collection_name=collection_name,
                points=points
            )
            return True
        except Exception as e:
            print(f"Erro ao adicionar chunks: {e}")
            return False

    def search_similar_chunks(self, collection_name: str, query: str, limit: int = 5):
        """Buscar chunks similares baseado em uma query"""
        try:
            # Gerar embedding da query
            query_embedding = self.generate_embedding(query)

            # Buscar no Qdrant
            results = self.client.search(
                collection_name=collection_name,
                query_vector=query_embedding,
                limit=limit
            )

            # Formatar resultados
            formatted_results = []
            for hit in results:
                formatted_results.append({
                    "point_id": hit.id,
                    "score": hit.score,
                    "content": hit.payload.get("content", ""),
                    "file_id": hit.payload.get("file_id"),
                    "file_name": hit.payload.get("file_name", ""),
                    "chunk_index": hit.payload.get("chunk_index"),
                    "chunk_id": hit.payload.get("chunk_id")
                })

            return formatted_results
        except Exception as e:
            print(f"Erro na busca: {e}")
            return []

    def delete_points_by_file(self, collection_name: str, file_id: int):
        """Deletar todos os pontos de um arquivo específico"""
        try:
            # Buscar pontos do arquivo
            points_to_delete = []

            # Fazer busca para encontrar pontos do arquivo
            scroll_result = self.client.scroll(
                collection_name=collection_name,
                limit=1000  # Ajustar conforme necessário
            )

            for point in scroll_result[0]:
                if point.payload.get("file_id") == file_id:
                    points_to_delete.append(point.id)

            if points_to_delete:
                self.client.delete(
                    collection_name=collection_name,
                    points_selector=models.PointIdsList(
                        points=points_to_delete
                    )
                )

            return True
        except Exception as e:
            print(f"Erro ao deletar pontos: {e}")
            return False