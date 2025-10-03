FROM python:3.11-slim

WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Atualizar pip e instalar dependências básicas
RUN pip install --upgrade pip setuptools wheel

# Copiar requirements e instalar dependências Python
COPY requirements.txt .

# Instalar dependências Python com cache otimizado e logs detalhados
RUN pip install --timeout=60 --verbose -r requirements.txt || \
    (echo "❌ Falha na instalação das dependências. Lista de pacotes:" && cat requirements.txt && exit 1)

# Copiar código da aplicação
COPY . .

# Criar diretório para uploads
RUN mkdir -p /app/uploads

# Expor porta
EXPOSE 8000

# Comando para iniciar a aplicação
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]