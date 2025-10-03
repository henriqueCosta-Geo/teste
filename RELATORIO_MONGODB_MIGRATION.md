# 📊 Relatório: Migração de Dados para MongoDB

**Data**: 2025-10-02
**Objetivo**: Analisar infraestrutura atual e propor migração para MongoDB

---

## 🎯 Executive Summary

O sistema atual utiliza **PostgreSQL** para armazenamento relacional e **Redis** para filas de processamento assíncrono de métricas. A proposta é migrar dados de **Analytics** e **Chat** para **MongoDB** para melhor performance em consultas não-estruturadas e escala horizontal.

---

## 📂 1. INFRAESTRUTURA ATUAL

### 1.1 Banco de Dados Atual

```
PostgreSQL (qdrant_admin)
├── Sistema Multi-tenant (customers, users)
├── Sistema RAG (collections, files, chunks)
├── Sistema de Agentes (agents, teams)
├── Sistema de Chat (chat_sessions, chat_messages)
└── Sistema de Analytics/Métricas
    ├── token_usage
    ├── user_metrics
    ├── performance_metrics
    ├── content_topics
    └── user_feedback
```

### 1.2 Sistema de Métricas Atual

**Componentes**:
- **PostgreSQL**: Armazenamento persistente de métricas
- **Redis**: Filas assíncronas para processamento
  - `metrics:execution` - Métricas de execução de agentes
  - `metrics:content` - Análise de conteúdo
  - `metrics:session` - Métricas de sessão
  - `metrics:classification` - Classificação de conversas

**Workers Assíncronos**:
- `_execution_worker` - Processa métricas de execução
- `_content_worker` - Extrai tópicos e keywords
- `_session_worker` - Métricas de sessões
- `_classification_worker` - Classificação IA de conversas
- `_cleanup_worker` - Limpeza de dados antigos
- `_auto_analysis_worker` - Análise automática por timeout

---

## 🔍 2. ANÁLISE DO SCHEMA ATUAL vs. PROPOSTO

### 2.1 Tabela: `chat_sessions` (PostgreSQL)

**Schema Atual**:
```sql
chat_sessions:
  - id (PK)
  - session_id (UUID unique)
  - team_id (FK -> agent_teams)
  - agent_id (FK -> agents)
  - created_at
  - last_activity
```

**Schema Proposto (MongoDB)**:
```javascript
// Coleção: Chats
{
  _id: ObjectId,
  chat_id: String,           // ✅ EQUIVALENTE: session_id
  customer_id: Number,       // ❌ FALTANDO no atual
  created_at: Date,          // ✅ JÁ EXISTE
  created_by: String,        // ❌ FALTANDO no atual
  analise_id: ObjectId,      // ❌ FALTANDO no atual
  mensagens: [
    {
      mensagem_id: String,   // ❌ FALTANDO no atual (apenas id)
      rag: Boolean,          // ❌ FALTANDO no atual
      user_assistant_id: String, // ⚠️ PARCIAL: temos agent_id/team_id
      feedback: Object,      // ❌ FALTANDO inline (temos tabela user_feedback)
      mensagem: String,      // ✅ JÁ EXISTE: content
      token_total: Number,   // ❌ FALTANDO inline (temos tabela token_usage)
      created_at: Date       // ✅ JÁ EXISTE
    }
  ]
}
```

### 2.2 Tabela: `chat_messages` (PostgreSQL)

**Schema Atual**:
```sql
chat_messages:
  - id (PK)
  - session_id (FK -> chat_sessions)
  - message_type ('user', 'team', 'agent', 'error')
  - content (TEXT)
  - message_metadata (JSON)
  - created_at
```

**Dados Extraídos Atualmente**:
- ✅ Mensagem ID
- ✅ Tipo de mensagem
- ✅ Conteúdo da mensagem
- ✅ Timestamp
- ✅ Metadata adicional (JSON)

**Dados FALTANTES para MongoDB**:
- ❌ RAG flag (se usou RAG ou não)
- ❌ Feedback inline por mensagem
- ❌ Token count inline por mensagem
- ❌ Customer ID na sessão

### 2.3 Tabela: `user_feedback` (PostgreSQL)

**Schema Atual**:
```sql
user_feedback:
  - id (PK)
  - session_id (String, indexed)
  - user_id (String)
  - agent_id (FK -> agents)
  - team_id (FK -> agent_teams)
  - rating (1-5)
  - issue_category (String)
  - feedback_comment (TEXT)
  - sentiment ('positivo', 'negativo', 'neutro')
  - auto_generated (Boolean)
  - created_at
```

**Correspondência MongoDB**:
- ✅ Todos os dados de feedback existem
- ❌ Mas está em tabela separada, não inline com mensagens

### 2.4 Tabela: `content_topics` (PostgreSQL)

**Schema Atual**:
```sql
content_topics:
  - id (PK)
  - session_id (String, indexed)
  - agent_id (FK -> agents)
  - extracted_topics (JSON array)
  - message_content (TEXT truncado)
  - topic_keywords (JSON array)
  - confidence_score (Float)
  - created_at
```

**Schema Proposto (MongoDB)**:
```javascript
// Coleção: Analytics
{
  _id: ObjectId,
  analise_id: String,       // ✅ EQUIVALENTE: id
  topico_principal: String, // ⚠️ PARCIAL: temos array de tópicos
  created_at: Date          // ✅ JÁ EXISTE
}
```

**Análise**:
- ✅ Já extraímos tópicos
- ✅ Já extraímos keywords
- ✅ Temos confidence score
- ❌ Falta "tópico principal" (atualmente temos array de todos os tópicos)
- ❌ Falta link direto entre Analise e Chat

---

## 📊 3. DADOS QUE JÁ SÃO EXTRAÍDOS

### ✅ Chat e Mensagens

| Campo                | Atual (PostgreSQL)      | Proposto (MongoDB) | Status |
|---------------------|-------------------------|-------------------|--------|
| Chat ID             | `session_id`            | `chat_id`         | ✅     |
| Created At          | `created_at`            | `created_at`      | ✅     |
| Team/Agent ID       | `team_id`, `agent_id`   | `user_assistant_id` | ✅   |
| Mensagem ID         | `id`                    | `mensagem_id`     | ✅     |
| Conteúdo            | `content`               | `mensagem`        | ✅     |
| Tipo                | `message_type`          | (implícito)       | ✅     |
| Metadata            | `message_metadata`      | (inline)          | ✅     |
| Timestamp Mensagem  | `created_at`            | `created_at`      | ✅     |

### ⚠️ Analytics (PARCIALMENTE EXTRAÍDO)

| Campo                | Atual (PostgreSQL)      | Proposto (MongoDB) | Status |
|---------------------|-------------------------|-------------------|--------|
| Análise ID          | `content_topics.id`     | `analise_id`      | ✅     |
| Tópicos Extraídos   | `extracted_topics[]`    | `topico_principal` | ⚠️    |
| Keywords            | `topic_keywords[]`      | -                 | ✅     |
| Created At          | `created_at`            | `created_at`      | ✅     |

**Nota**: Temos **array de tópicos**, mas o schema propõe apenas **1 tópico principal**. Precisamos determinar qual tópico é o principal.

---

## ❌ 4. DADOS FALTANTES

### 4.1 Campos Faltantes em `Chats`

| Campo           | Descrição                          | Como Obter                              |
|-----------------|------------------------------------|-----------------------------------------|
| `customer_id`   | ID do customer dono do chat        | ❌ **Não está sendo capturado atualmente** |
| `created_by`    | Usuário que iniciou o chat         | ❌ **Não está sendo capturado atualmente** |
| `analise_id`    | Link para análise do chat          | ⚠️ **Pode ser criado ao finalizar chat** |

### 4.2 Campos Faltantes em `Mensagens`

| Campo             | Descrição                          | Como Obter                              |
|-------------------|------------------------------------|-----------------------------------------|
| `rag`             | Se a mensagem usou RAG             | ❌ **Não está sendo capturado** - Precisa adicionar no `metadata` |
| `feedback`        | Feedback inline da mensagem        | ⚠️ **Existe em tabela separada** - Precisa consolidar |
| `token_total`     | Tokens usados nesta mensagem       | ⚠️ **Existe em tabela separada** - Precisa consolidar |
| `user_assistant_id` | ID mais específico do remetente  | ⚠️ **Parcialmente** - Temos agent_id/team_id mas não user_id |

### 4.3 Campos Faltantes em `Analytics`

| Campo              | Descrição                          | Como Obter                              |
|--------------------|------------------------------------|-----------------------------------------|
| `topico_principal` | Tópico mais relevante              | ⚠️ **Precisa algoritmo** - Pegar primeiro do array ou usar frequência |

---

## 🔧 5. ENDPOINTS QUE SALVAM DADOS

### 5.1 Chat Service (`chat_service.py`)

**Métodos**:
```python
# ✅ JÁ IMPLEMENTADO
get_or_create_session(session_id, team_id, agent_id)
  → Cria ChatSession no PostgreSQL

add_message(session_id, message_type, content, metadata)
  → Cria ChatMessage no PostgreSQL

get_chat_history(session_id, limit)
  → Retorna histórico de mensagens
```

**Dados Salvos**:
- ✅ Session ID
- ✅ Team/Agent ID
- ✅ Message content, type, metadata
- ✅ Timestamps

**Dados NÃO Salvos**:
- ❌ Customer ID
- ❌ User ID (created_by)
- ❌ RAG flag
- ❌ Tokens inline
- ❌ Feedback inline

### 5.2 Metrics Collector (`metrics_collector.py`)

**Métodos**:
```python
# ✅ JÁ IMPLEMENTADO
collect_execution_metrics(data)
  → Salva em token_usage, agent_executions, performance_metrics

collect_content_metrics(data)
  → Salva em content_topics (extrai tópicos e keywords)

collect_session_metrics(data)
  → Salva em user_metrics

request_conversation_classification(session_id, conversation_data)
  → Usa IA para classificar e salva em user_feedback e content_topics
```

**Dados Salvos**:
- ✅ Tokens (input/output)
- ✅ Custos
- ✅ Tópicos extraídos
- ✅ Keywords
- ✅ Sentiment
- ✅ Feedback

**Dados NÃO Salvos**:
- ❌ RAG usage flag
- ❌ Tópico principal (apenas array)

### 5.3 Teams Endpoints (`teams_endpoints.py`)

**Endpoint**: `POST /api/teams/{team_id}/execute`

**Fluxo de Salvamento**:
```python
1. ChatService.add_message(session_id, 'user', task)
   → Salva mensagem do usuário

2. AgentManager.execute_team_task(...)
   → Executa coordenação

3. metrics_collector.collect_execution_metrics(...)
   → Salva métricas de execução

4. ChatService.add_message(session_id, 'team', response)
   → Salva resposta do time
```

**O que está sendo salvo**:
- ✅ Mensagens de usuário e time
- ✅ Métricas de execução
- ✅ Tokens e custos
- ✅ Session tracking

**O que NÃO está sendo salvo**:
- ❌ Customer ID
- ❌ User ID específico
- ❌ Flag de uso de RAG
- ❌ Análise automática ao finalizar (apenas por timeout)

---

## 🔌 6. VARIÁVEIS .ENV NECESSÁRIAS PARA MONGODB

### 6.1 Variáveis Atuais

```bash
# Backend (.env)
DATABASE_URL=postgresql://admin:admin123@localhost:5432/qdrant_admin
QDRANT_URL=https://...
QDRANT_API_KEY=...
OPENAI_API_KEY=...
REDIS_URL=redis://redis:6379  # Adicionado no docker-compose
```

### 6.2 Variáveis NOVAS para MongoDB

```bash
# ========================================
# MONGODB CONFIGURATION
# ========================================

# MongoDB Connection String (Railway)
MONGODB_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority

# Ou se for instância standalone
MONGODB_URL=mongodb://<username>:<password>@<host>:<port>/<database>?authSource=admin

# Nome do banco de dados MongoDB
MONGODB_DATABASE=qdrant_analytics

# Coleções MongoDB
MONGODB_COLLECTION_CHATS=chats
MONGODB_COLLECTION_ANALYTICS=analytics

# Opções de conexão (opcional)
MONGODB_MAX_POOL_SIZE=50
MONGODB_MIN_POOL_SIZE=10
MONGODB_TIMEOUT=10000
```

### 6.3 Estrutura Completa Recomendada

```bash
# ========================================
# POSTGRESQL (Sistema Principal)
# ========================================
DATABASE_URL=postgresql://admin:admin123@postgres:5432/qdrant_admin

# ========================================
# MONGODB (Analytics & Chat)
# ========================================
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DATABASE=qdrant_analytics
MONGODB_COLLECTION_CHATS=chats
MONGODB_COLLECTION_ANALYTICS=analytics

# ========================================
# REDIS (Filas Assíncronas)
# ========================================
REDIS_URL=redis://redis:6379

# ========================================
# QDRANT (Vector Database)
# ========================================
QDRANT_URL=https://...
QDRANT_API_KEY=...

# ========================================
# OPENAI (LLM)
# ========================================
OPENAI_API_KEY=sk-...

# ========================================
# SISTEMA
# ========================================
AGNO_LOG_LEVEL=INFO
AGNO_SESSION_TIMEOUT=3600
```

---

## 📋 7. TO-DO LIST PARA MIGRAÇÃO

### 📦 Fase 1: Configuração e Dependências

- [ ] **Adicionar dependência MongoDB ao `requirements.txt`**
  ```txt
  pymongo>=4.6.0
  motor>=3.3.0  # Driver assíncrono (recomendado)
  ```

- [ ] **Criar variáveis de ambiente MongoDB no `.env`**
  ```bash
  MONGODB_URL=...
  MONGODB_DATABASE=qdrant_analytics
  ```

- [ ] **Adicionar MongoDB ao `docker-compose.yml` (OPCIONAL - se não usar Railway)**
  ```yaml
  mongodb:
    image: mongo:7
    container_name: qdrant_admin_mongodb
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: admin123
      MONGO_INITDB_DATABASE: qdrant_analytics
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    networks:
      - app_network
  ```

### 🔧 Fase 2: Código de Conexão

- [ ] **Criar arquivo `backend/mongo_service.py`**
  ```python
  from motor.motor_asyncio import AsyncIOMotorClient
  import os

  class MongoService:
      def __init__(self):
          self.client = None
          self.db = None

      async def connect(self):
          self.client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
          self.db = self.client[os.getenv("MONGODB_DATABASE")]

      async def close(self):
          if self.client:
              self.client.close()

      def get_collection(self, name: str):
          return self.db[name]
  ```

- [ ] **Inicializar MongoDB no `main.py` (startup)**
  ```python
  from mongo_service import MongoService

  mongo_service = None

  @app.on_event("startup")
  async def startup():
      global mongo_service
      mongo_service = MongoService()
      await mongo_service.connect()
  ```

### 📝 Fase 3: Modificar Capturas de Dados

- [ ] **Adicionar `customer_id` ao `ChatSession`**
  - Modificar schema Prisma/SQLAlchemy
  - Atualizar `chat_service.py` para receber customer_id
  - Atualizar endpoints que criam sessões

- [ ] **Adicionar `user_id` (created_by) ao `ChatSession`**
  - Passar user_id do frontend para backend
  - Salvar no chat_sessions

- [ ] **Adicionar flag `rag` ao metadata de mensagens**
  - Quando usar RAG, adicionar `{"rag": true}` ao metadata
  - Modificar `agents.py` para incluir flag

- [ ] **Consolidar tokens inline nas mensagens**
  - Calcular tokens por mensagem
  - Adicionar ao metadata: `{"tokens": {"input": X, "output": Y}}`

### 🔄 Fase 4: Criar Serviço de Escrita MongoDB

- [ ] **Criar `backend/mongo_chat_service.py`**
  ```python
  class MongoChatService:
      def __init__(self, mongo_service):
          self.mongo = mongo_service
          self.chats = mongo_service.get_collection("chats")
          self.analytics = mongo_service.get_collection("analytics")

      async def save_chat(self, session_data):
          """Salvar chat completo no MongoDB"""
          # Implementar lógica

      async def add_message_to_chat(self, chat_id, message_data):
          """Adicionar mensagem a um chat existente"""
          # Implementar lógica

      async def create_analysis(self, session_id, topics):
          """Criar análise de um chat"""
          # Implementar lógica
  ```

- [ ] **Integrar MongoChatService nos endpoints**
  - Modificar `teams_endpoints.py`
  - Modificar `agent_endpoints.py`
  - Chamar MongoDB em paralelo ao PostgreSQL (dupla escrita)

### 🧪 Fase 5: Sincronização Dual

- [ ] **Implementar escrita dupla (PostgreSQL + MongoDB)**
  - Manter PostgreSQL como principal
  - Escrever também no MongoDB
  - Garantir consistência eventual

- [ ] **Criar worker de sincronização**
  - Ler dados do PostgreSQL
  - Migrar para MongoDB em background
  - Tratar erros e retry

### 📊 Fase 6: Analytics e Tópico Principal

- [ ] **Modificar `content_topics` para incluir `main_topic`**
  ```python
  def determine_main_topic(topics_array):
      # Lógica: pegar o primeiro ou mais frequente
      return topics_array[0] if topics_array else "geral"
  ```

- [ ] **Criar análise ao finalizar chat**
  - Trigger ao detectar inatividade
  - Ou endpoint explícito para finalizar chat
  - Gerar `analise_id` e salvar no MongoDB

### 🔍 Fase 7: Testes e Validação

- [ ] **Testar criação de chat no MongoDB**
- [ ] **Testar adição de mensagens**
- [ ] **Testar criação de análises**
- [ ] **Verificar índices MongoDB para performance**
- [ ] **Validar queries comuns**

### 🚀 Fase 8: Migration Tool

- [ ] **Criar script de migração histórica**
  ```python
  # backend/migrate_to_mongo.py
  # Migrar dados existentes do PostgreSQL para MongoDB
  ```

- [ ] **Executar migração de dados históricos**
- [ ] **Validar integridade dos dados migrados**

---

## 🎯 8. RESUMO EXECUTIVO

### O que já temos ✅

1. **Sistema de Chat funcional** salvando em PostgreSQL
2. **Sistema de Métricas robusto** com Redis e workers assíncronos
3. **Extração automática** de tópicos, keywords, sentiment
4. **Classificação IA** de conversas
5. **Histórico completo** de mensagens

### O que falta ❌

1. **Customer ID** nas sessões de chat
2. **User ID (created_by)** nas sessões
3. **Flag RAG** inline nas mensagens
4. **Tokens inline** por mensagem
5. **Feedback inline** por mensagem
6. **Tópico principal** (apenas temos array)
7. **Análise ID** linkando chat com análise
8. **Conexão MongoDB** e serviços de escrita
9. **Dupla escrita** PostgreSQL + MongoDB
10. **Script de migração** de dados históricos

### Esforço Estimado ⏱️

| Fase | Descrição | Esforço |
|------|-----------|---------|
| 1 | Configuração e Dependências | 1h |
| 2 | Código de Conexão MongoDB | 2h |
| 3 | Modificar Capturas de Dados | 4h |
| 4 | Criar Serviço MongoDB | 3h |
| 5 | Sincronização Dual | 3h |
| 6 | Analytics e Tópico Principal | 2h |
| 7 | Testes e Validação | 3h |
| 8 | Migration Tool | 4h |
| **TOTAL** | - | **~22h** |

---

## 📌 9. RECOMENDAÇÕES

### Estratégia Recomendada: **Dual Write**

1. **Manter PostgreSQL** como source of truth
2. **Escrever também no MongoDB** para analytics
3. **Migrar queries de analytics** para MongoDB gradualmente
4. **Manter compatibilidade** com sistema atual

### Vantagens

- ✅ Sem downtime
- ✅ Rollback fácil
- ✅ Testes em produção
- ✅ Migração gradual

### Próximos Passos Imediatos

1. **Criar MongoDB na Railway** ✅ (você já tem)
2. **Adicionar variáveis .env** (tarefa do usuário)
3. **Instalar dependências** Python (motor/pymongo)
4. **Criar mongo_service.py** (eu faço)
5. **Modificar chat_service** para capturar dados faltantes (eu faço)
6. **Implementar escrita dupla** (eu faço)

---

## 📝 10. PRÓXIMA AÇÃO

**Aguardando usuário configurar**:
```bash
MONGODB_URL=mongodb+srv://...  # String de conexão da Railway
MONGODB_DATABASE=qdrant_analytics
```

**Após isso, posso**:
1. Adicionar motor/pymongo ao requirements.txt
2. Criar mongo_service.py
3. Modificar chat_service.py para capturar customer_id e user_id
4. Implementar MongoChatService
5. Integrar nos endpoints existentes

---

**Fim do Relatório**
