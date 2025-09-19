import os
import re
from typing import List, Dict
from PyPDF2 import PdfReader
from docx import Document


class FileProcessor:
    def __init__(self):
        pass

    def extract_text_from_file(self, file_path: str, file_type: str) -> str:
        """Extrair texto de diferentes tipos de arquivo"""
        try:
            if file_type.lower() == 'pdf':
                return self._extract_from_pdf(file_path)
            elif file_type.lower() in ['docx', 'doc']:
                return self._extract_from_docx(file_path)
            elif file_type.lower() == 'txt':
                return self._extract_from_txt(file_path)
            elif file_type.lower() == 'md':
                return self._extract_from_markdown(file_path)
            else:
                raise ValueError(f"Tipo de arquivo não suportado: {file_type}")
        except Exception as e:
            print(f"Erro ao extrair texto: {e}")
            return ""

    def _extract_from_pdf(self, file_path: str) -> str:
        """Extrair texto de PDF"""
        text = ""
        with open(file_path, 'rb') as file:
            pdf_reader = PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        return text

    def _extract_from_docx(self, file_path: str) -> str:
        """Extrair texto de DOCX"""
        doc = Document(file_path)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text

    def _extract_from_txt(self, file_path: str) -> str:
        """Extrair texto de TXT"""
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()

    def _extract_from_markdown(self, file_path: str) -> str:
        """Extrair texto de Markdown"""
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()

    def create_chunks(self, text: str, chunk_size: int = 1000, chunk_overlap: int = 100) -> List[str]:
        """Dividir texto em chunks inteligentes com sobreposição"""
        if not text.strip():
            return []

        # Limpar texto
        text = self._clean_text(text)

        # Tentar quebrar por estruturas semânticas primeiro
        chunks = self._intelligent_chunking(text, chunk_size, chunk_overlap)

        if not chunks:
            # Fallback para método simples se a quebra inteligente falhar
            chunks = self._simple_chunking(text, chunk_size, chunk_overlap)

        return chunks

    def _intelligent_chunking(self, text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
        """Chunking inteligente baseado em estrutura do documento"""
        try:
            chunks = []

            # Primeiro, tentar quebrar por parágrafos duplos
            paragraphs = re.split(r'\n\s*\n', text)

            current_chunk = ""

            for paragraph in paragraphs:
                paragraph = paragraph.strip()
                if not paragraph:
                    continue

                # Se adicionar este parágrafo não ultrapassar muito o limite
                if len(current_chunk) + len(paragraph) + 2 <= chunk_size * 1.2:
                    if current_chunk:
                        current_chunk += "\n\n" + paragraph
                    else:
                        current_chunk = paragraph
                else:
                    # Salvar chunk atual se não estiver vazio
                    if current_chunk.strip():
                        chunks.append(current_chunk.strip())

                    # Se o parágrafo é muito grande, quebrar por frases
                    if len(paragraph) > chunk_size:
                        sentence_chunks = self._break_by_sentences(paragraph, chunk_size, chunk_overlap)
                        chunks.extend(sentence_chunks)
                        current_chunk = ""
                    else:
                        current_chunk = paragraph

            # Adicionar último chunk
            if current_chunk.strip():
                chunks.append(current_chunk.strip())

            # Aplicar sobreposição se necessário
            if chunk_overlap > 0 and len(chunks) > 1:
                chunks = self._apply_overlap(chunks, chunk_overlap)

            return chunks

        except Exception as e:
            print(f"Erro no chunking inteligente: {e}")
            return []

    def _break_by_sentences(self, text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
        """Quebrar texto grande por frases"""
        # Padrão para encontrar finais de frase
        sentence_pattern = r'[.!?]+\s+'
        sentences = re.split(sentence_pattern, text)

        chunks = []
        current_chunk = ""

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            if len(current_chunk) + len(sentence) + 1 <= chunk_size:
                if current_chunk:
                    current_chunk += ". " + sentence
                else:
                    current_chunk = sentence
            else:
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())

                # Se uma única frase é muito grande, quebrar por palavras
                if len(sentence) > chunk_size:
                    word_chunks = self._break_by_words(sentence, chunk_size)
                    chunks.extend(word_chunks)
                    current_chunk = ""
                else:
                    current_chunk = sentence

        if current_chunk.strip():
            chunks.append(current_chunk.strip())

        return chunks

    def _break_by_words(self, text: str, chunk_size: int) -> List[str]:
        """Quebrar texto muito grande por palavras"""
        words = text.split()
        chunks = []
        current_chunk = ""

        for word in words:
            if len(current_chunk) + len(word) + 1 <= chunk_size:
                if current_chunk:
                    current_chunk += " " + word
                else:
                    current_chunk = word
            else:
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())
                current_chunk = word

        if current_chunk.strip():
            chunks.append(current_chunk.strip())

        return chunks

    def _apply_overlap(self, chunks: List[str], overlap_size: int) -> List[str]:
        """Aplicar sobreposição entre chunks"""
        if len(chunks) <= 1:
            return chunks

        overlapped_chunks = [chunks[0]]

        for i in range(1, len(chunks)):
            prev_chunk = chunks[i - 1]
            current_chunk = chunks[i]

            # Pegar últimas palavras do chunk anterior
            prev_words = prev_chunk.split()
            overlap_words = prev_words[-min(overlap_size // 10, len(prev_words)):]
            overlap_text = " ".join(overlap_words)

            # Adicionar sobreposição ao chunk atual
            if overlap_text and len(overlap_text) < len(current_chunk):
                overlapped_chunk = overlap_text + " " + current_chunk
                overlapped_chunks.append(overlapped_chunk)
            else:
                overlapped_chunks.append(current_chunk)

        return overlapped_chunks

    def _simple_chunking(self, text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
        """Método de chunking simples (fallback)"""
        chunks = []
        start = 0
        text_length = len(text)

        while start < text_length:
            end = start + chunk_size

            # Tentar quebrar em um ponto natural (final de frase)
            if end < text_length:
                # Procurar por ponto final próximo
                next_period = text.find('.', end - 100, end + 100)
                if next_period != -1:
                    end = next_period + 1

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            # Calcular próximo início com sobreposição
            start = end - chunk_overlap
            if start <= 0:
                start = end

        return chunks

    def _clean_text(self, text: str) -> str:
        """Limpar e normalizar texto"""
        # Preservar estruturas importantes do markdown
        text = re.sub(r'\n{3,}', '\n\n', text)  # Reduzir quebras excessivas
        text = re.sub(r' {2,}', ' ', text)  # Reduzir espaços excessivos
        text = re.sub(r'\t', ' ', text)  # Converter tabs em espaços

        # Preservar caracteres importantes do markdown
        # Não remover #, *, -, etc. que são importantes para estrutura

        return text.strip()

    def get_text_preview(self, text: str, max_length: int = 200) -> str:
        """Obter preview do texto"""
        if len(text) <= max_length:
            return text

        preview = text[:max_length]
        last_space = preview.rfind(' ')

        if last_space > max_length * 0.8:  # Se encontrou espaço próximo ao final
            preview = preview[:last_space]

        return preview + "..."

    def get_chunk_stats(self, chunks: List[str]) -> Dict:
        """Obter estatísticas dos chunks"""
        if not chunks:
            return {
                "total_chunks": 0,
                "avg_chunk_size": 0,
                "min_chunk_size": 0,
                "max_chunk_size": 0,
                "total_characters": 0
            }

        chunk_sizes = [len(chunk) for chunk in chunks]

        return {
            "total_chunks": len(chunks),
            "avg_chunk_size": sum(chunk_sizes) // len(chunk_sizes),
            "min_chunk_size": min(chunk_sizes),
            "max_chunk_size": max(chunk_sizes),
            "total_characters": sum(chunk_sizes)
        }