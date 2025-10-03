# Relatório de Análise: Sistema RAG Multi-Agentes

**Data:** 2025-09-30
**Análise:** Coordenação de Times e Chamadas Consecutivas de RAG

---

## 📋 Resumo Executivo

O sistema implementado é uma arquitetura sofisticada de **Multi-Agent RAG (Retrieval-Augmented Generation)** que permite coordenação inteligente entre agentes especializados. A análise revela um sistema bem estruturado com padrões avançados de delegação e estratégias inteligentes de busca em bases de conhecimento.

### 🎯 Pontos Fortes Identificados
- **Delegação Inteligente**: Sistema flexível que identifica automaticamente o melhor especialista
- **RAG Automático**: Busca proativa em bases de conhecimento antes da resposta
- **Streaming em Tempo Real**: Interface responsiva com feedback instantâneo
- **Métricas Completas**: Sistema robusto de coleta e análise de performance

---

## 🏗️ Arquitetura do Sistema

### Componentes Principais

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FastAPI Main  │    │  Agent Manager  │    │ Teams Endpoints │
│                 │◄──►│                 │◄──►│                 │
│ • Routes        │    │ • Coordination  │    │ • Team Execution│
│ • CORS          │    │ • RAG Tools     │    │ • Streaming     │
│ • Startup       │    │ • Caching       │    │ • Chat Service  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Qdrant Service  │    │ Agent Models    │    │MetricsCollector │
│                 │    │                 │    │                 │
│ • Vector Search │    │ • DB Schema     │    │ • Redis Queue   │
│ • Embeddings    │    │ • Relations     │    │ • Workers       │
│ • Collections   │    │ • Sessions      │    │ • Analytics     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🤖 Funcionamento dos Times

### 1. Estratégias de Delegação

O sistema implementa **duas estratégias inteligentes** de delegação:

#### A) **Estratégia Específica de Máquinas** (`agents.py:698-773`)
```python
def _execute_with_model_matching(self, team_id: int, team, team_members: List[Dict],
                               leader_config: Dict, task: str, context_text: str,
                               context_history: List[Dict], start_time: float) -> Dict:
```

**Como Funciona:**
1. **Detecção de Padrões**: Identifica agentes especializados em máquinas (CH570, A9000, etc.)
2. **Mapeamento Inteligente**: Cria dicionário `model_mapping` correlacionando modelos → especialistas
3. **Análise Contextual**: Examina pergunta + histórico buscando menções de modelos específicos
4. **Delegação Automática**: Se encontrar match, delega diretamente ao especialista
5. **Triagem Inteligente**: Se não encontrar, líder pergunta qual máquina específica

#### B) **Estratégia Flexível** (`agents.py:775-806`)
```python
def _execute_with_flexible_delegation(self, team_id: int, team, team_members: List[Dict],
                                    leader_config: Dict, task: str, context_text: str,
                                    context_history: List[Dict], start_time: float) -> Dict:
```

**Como Funciona:**
1. **Análise de Competências**: Avalia descrições, instruções e papéis dos agentes
2. **Pontuação por Relevância**: Calcula score baseado em palavras-chave + coleções RAG
3. **Delegação Inteligente**: Se score significativo (≥3), delega ao melhor agente
4. **Coordenação Colaborativa**: Caso contrário, líder coordena resposta

---

## 🔍 Sistema RAG: Chamadas Consecutivas

### Como os RAGs São Chamados

#### 1. **RAG Automático por Especialista** (`agents.py:855-946`)

Quando um especialista é selecionado, **o sistema automaticamente busca nas suas bases de conhecimento ANTES da execução**:

```python
# BUSCA RAG AUTOMÁTICA ANTES DA EXECUÇÃO
rag_context = ""
agent_id = specialist['id']

# Buscar coleções RAG do agente especialista
agent_collections = self.get_agent_collections(agent_id)
if agent_collections:
    logger.info(f"🔍 [TIME-{team_id}] FAZENDO BUSCA RAG AUTOMÁTICA PARA ESPECIALISTA...")
    collection_names = [col['name'] for col in agent_collections]

    # Criar instância RAG temporária para busca
    temp_rag = QdrantRAGTool(self.qdrant_service, collection_names, self.db)

    try:
        # Fazer busca automática com termos da tarefa
        initial_results = temp_rag.search(task, limit=5)
        if initial_results and not any('error' in str(r) for r in initial_results):
            rag_context = "\n\n🗄️ INFORMAÇÕES DAS BASES DE CONHECIMENTO:\n"
            for i, result in enumerate(initial_results[:3]):
                content = result.get('text', result.get('content', ''))
                rag_context += f"{i+1}. {content[:500]}...\n\n"
```

**Sequência de Execução:**
1. **Identificação do Especialista** → Sistema seleciona agente baseado na tarefa
2. **Busca RAG Automática** → Faz busca nas coleções do especialista ANTES de executar
3. **Contexto Enriquecido** → Adiciona resultados RAG ao prompt do especialista
4. **Execução Informada** → Especialista responde com base nas informações encontradas

#### 2. **QdrantRAGTool: Motor de Busca** (`agents.py:36-135`)

```python
class QdrantRAGTool:
    def search(self, query: str, collection_name: str = None, limit: int = 5) -> List[Dict]:
        # Validar acesso à coleção
        if collection_name and collection_name not in self.allowed_collections:
            error_msg = f"Acesso negado à coleção '{collection_name}'"
            return [{"error": error_msg, "allowed_collections": self.allowed_collections}]

        results = []
        collections_to_search = [collection_name] if collection_name else self.allowed_collections

        # Buscar em cada coleção permitida
        for coll_name in collections_to_search:
            coll_results = self.qdrant_service.search_similar_chunks(
                coll_name, query, limit
            )
            # Adicionar metadados da coleção
            for result in coll_results:
                result['collection'] = coll_name
                result['search_query'] = query
            results.extend(coll_results)

        # Ordenar por score (maior primeiro)
        results.sort(key=lambda x: x.get('score', 0), reverse=True)
```

**Recursos Avançados:**
- **Controle de Acesso**: Cada agente só acessa suas coleções permitidas
- **Busca Multi-Coleção**: Busca simultânea em múltiplas bases
- **Ordenação por Relevância**: Ordena resultados por score de similaridade
- **Metadados Ricos**: Preserva informações de origem e contexto

---

## 📊 Coordenação e Comunicação

### 1. **Chat Service: Gestão de Contexto** (`chat_service.py:16-119`)

```python
class ChatService:
    def get_context_for_agent(self, session_id: str, max_messages: int = 10) -> List[Dict]:
        """Obtém contexto formatado para enviar ao agente"""
        messages = self.get_chat_history(session_id, max_messages)

        context = []
        for msg in messages:
            context.append({
                "type": msg.message_type,
                "content": msg.content,
                "timestamp": msg.created_at.isoformat(),
                "metadata": msg.message_metadata
            })
        return context
```

**Funcionalidades:**
- **Histórico Persistente**: Mantém contexto entre interações
- **Metadados Ricos**: Rastrea sender, timing, team_id
- **Contexto Inteligente**: Fornece histórico relevante aos agentes

### 2. **Streaming e Feedback em Tempo Real** (`teams_endpoints.py:315-368`)

```python
async def generate_stream():
    try:
        start_time = time.time()
        # Evento de início
        yield f"data: {json.dumps({'type': 'start', 'team_name': team.name, 'members': [m.name for m in members]})}\n\n"

        # Executar tarefa e simular streaming baseado na resposta do agno
        result = agent_manager.execute_team_task_with_context(team_id, task, context_history)

        if result.get('success'):
            response_content = result.get('team_response', '')
            # Simular streaming progressivo - construir palavra por palavra
            words = response_content.split(' ')
            current_text = ''

            for i, word in enumerate(words):
                current_text += word + (' ' if i < len(words) - 1 else '')
                # Enviar o texto acumulado a cada palavra
                yield f"data: {json.dumps({'type': 'content', 'content': current_text, 'agent_name': result.get('agents_involved', ['Time'])[0]})}\n\n"
                await asyncio.sleep(0.05)  # Pausa pequena para simular escrita
```

---

## ⚡ Fluxo de Execução Completo

### Cenário: "Problema na colheita da CH570"

```
1. [FRONTEND] → POST /api/teams/{team_id}/execute
   ├─ task: "Problema na colheita da CH570"
   ├─ session_id: "uuid-123"
   └─ stream: true

2. [CHAT SERVICE] → Adiciona mensagem do usuário ao histórico
   ├─ Cria/atualiza sessão
   ├─ Salva mensagem com metadata
   └─ Recupera contexto (últimas 10 mensagens)

3. [AGENT MANAGER] → execute_team_task_with_context()
   ├─ Busca team + membros no banco
   ├─ Identifica estratégia: "specific_model_matching"
   └─ Chama _execute_with_model_matching()

4. [DELEGAÇÃO INTELIGENTE] → Análise do texto
   ├─ model_mapping = {'CH570': 'Especialista CH570', ...}
   ├─ Busca padrão "ch570" no texto (case insensitive)
   ├─ MATCH encontrado! → should_delegate = True
   └─ target_specialist = "Especialista CH570"

5. [RAG AUTOMÁTICO] → _execute_specialist_directly()
   ├─ agent_collections = get_agent_collections(specialist_id)
   ├─ collection_names = ['base_colheitadeiras', 'manuais_ch570']
   ├─ temp_rag = QdrantRAGTool(qdrant_service, collection_names, db)
   ├─ initial_results = temp_rag.search("Problema na colheita da CH570", limit=5)
   └─ rag_context = "🗄️ INFORMAÇÕES DAS BASES...\n1. Problema comum..."

6. [ESPECIALISTA] → Execução com contexto RAG
   ├─ specialist_context = f"{context_text}\n{rag_context}\nForneça resposta técnica..."
   ├─ specialist_agent = get_or_create_agent(specialist_id, specialist_config)
   └─ response = specialist_agent.run(specialist_context)

7. [STREAMING] → Resposta progressiva
   ├─ words = response.split(' ')
   ├─ Para cada palavra: yield palavra acumulada
   └─ Frontend atualiza em tempo real

8. [METRICS] → Coleta assíncrona
   ├─ Execução salva no banco
   ├─ Métricas enviadas para Redis
   └─ Workers processam estatísticas
```

---

## 📈 Sistema de Métricas

### MetricsCollector: Análise em Tempo Real (`metrics_collector.py`)

**Workers Assíncronos:**
- `_execution_worker()`: Processa métricas de execução
- `_content_worker()`: Analisa conteúdo e extrai tópicos
- `_session_worker()`: Rastrea sessões de usuário
- `_classification_worker()`: Classifica conversas automaticamente
- `_cleanup_worker()`: Limpa dados antigos
- `_auto_analysis_worker()`: Análise automática de conversas

**Filas Redis:**
```python
EXECUTION_QUEUE = "metrics:execution"     # Tempos, tokens, custos
CONTENT_QUEUE = "metrics:content"         # Análise de tópicos
SESSION_QUEUE = "metrics:session"         # Atividade de usuários
CLASSIFICATION_QUEUE = "metrics:classification"  # Classificação de conversas
```

---

## 🎯 Cenários de Uso

### 1. **Máquina Específica Mencionada**
```
Usuário: "CH570 com problema no elevador"
├─ Sistema detecta "CH570" no texto
├─ Mapeia para "Especialista CH570"
├─ RAG busca em ['base_ch570', 'manuais_colheitadeiras']
├─ Especialista responde com informações específicas
└─ Resultado: Resposta técnica precisa
```

### 2. **Máquina NÃO Especificada**
```
Usuário: "Freios não estão funcionando bem"
├─ Sistema não detecta modelo específico
├─ Líder recebe contexto de triagem
├─ Resposta: "Qual máquina específica? (CH570, A9000, A8800...)"
└─ Usuário especifica → Nova rodada com delegação
```

### 3. **Consulta Geral**
```
Usuário: "Como fazer manutenção preventiva?"
├─ Estratégia flexível ativada
├─ _find_best_agent_for_task() calcula scores
├─ Agente com mais coleções RAG sobre manutenção recebe
├─ RAG busca em bases gerais
└─ Resposta: Guia geral de manutenção
```

---

## 🚀 Pontos Fortes da Implementação

### 1. **Inteligência de Delegação**
- **Automática**: Detecta automaticamente qual especialista chamar
- **Contextual**: Usa histórico da conversa para decisões
- **Flexível**: Adapta estratégia baseado no tipo de team

### 2. **RAG Proativo**
- **Busca Automática**: RAG acontece automaticamente para especialistas
- **Multi-Base**: Busca simultânea em múltiplas coleções
- **Contextualizado**: Resultados integrados ao prompt do agente

### 3. **Interface Responsiva**
- **Streaming Real**: Feedback palavra por palavra
- **Metadados Ricos**: Informações detalhadas sobre execução
- **Histórico Persistente**: Contexto mantido entre sessões

### 4. **Observabilidade Completa**
- **Métricas Detalhadas**: Tokens, custos, tempos, sucessos
- **Análise Automática**: Classificação de conversas via IA
- **Dashboard Real-time**: Monitoramento ativo do sistema

---

## ⚠️ Pontos de Atenção

### 1. **Dependências Críticas**
- **Redis**: Sistema de métricas depende fortemente do Redis
- **OpenAI API**: Falhas na API impactam todo o sistema
- **Qdrant**: Indisponibilidade afeta buscas RAG

### 2. **Performance**
- **RAG Automático**: Adiciona latência mas melhora qualidade
- **Streaming**: Simula tempo real mas response já está pronta
- **Cache de Agentes**: Importante para performance

### 3. **Escalabilidade**
- **Workers**: Podem precisar tuning para alta carga
- **Banco de Dados**: Tabelas de métricas podem crescer rapidamente
- **Coleções RAG**: Muitas coleções podem impactar busca

---

## 🔮 Conclusão

O sistema implementa uma arquitetura **multi-agente RAG de alta sofisticação**, combinando:

- **Coordenação Inteligente**: Delegação automática baseada em contexto
- **RAG Proativo**: Busca automática em bases de conhecimento especializadas
- **Streaming Responsivo**: Interface em tempo real com feedback instantâneo
- **Observabilidade Completa**: Métricas detalhadas e análise automática

**Resultado:** Sistema que oferece respostas especializadas e precisas, com excelente experiência de usuário e capacidade de monitoramento avançada.

A coordenação entre agentes e o sistema de RAG consecutivo funcionam de forma **harmoniosa e inteligente**, proporcionando um sistema robusto e escalável para automação de suporte técnico especializado.

---

**Relatório gerado em:** 2025-09-30
**Autor:** Análise Automatizada do Sistema