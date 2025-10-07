# MongoDB Schema Documentation

## Collection: `chats`

### Chat Document

```javascript
{
  "_id": ObjectId("..."),
  "chat_id": "team-3-1759522381089",  // Unique session identifier
  "customer_id": 123,                  // ID do cliente (nullable)
  "created_at": ISODate("2025-10-03T20:13:09.858Z"),
  "created_by": 4,                     // User ID que criou o chat
  "analise_id": null,                  // ID da análise (preenchido ao finalizar chat)
  "agent_id": null,                    // ID do agente (se chat direto com agente)
  "team_id": 3,                        // ID do time (se chat com time)
  "mensagens": [...]                   // Array de mensagens (ver abaixo)
}
```

---

## Message Document (dentro de `mensagens` array)

### ✅ NOVO SCHEMA COMPLETO

```javascript
{
  // ============================================
  // IDENTIFICAÇÃO
  // ============================================
  "mensagem_id": "9d12baf5-fcbe-43fb-a540-bd856aed970b",  // UUID único
  "message_type": "team",                                  // "user" | "agent" | "team"
  "created_at": ISODate("2025-10-03T20:17:35.902Z"),

  // ============================================
  // CONTEÚDO
  // ============================================
  "mensagem": "## Procedimento Detalhado...",              // Conteúdo completo da mensagem

  // ============================================
  // IDENTIFICAÇÃO DO EMISSOR
  // ============================================
  "user_assistant_id": 7,                                  // ID do user (int) OU ID do agente (int) OU "Coordenador" (string)
  "agent_name": "Agente Case A9000",                       // Nome do agente (se aplicável)
  "team_id": 3,                                            // ID do time (se mensagem de time)
  "team_name": "IntelliProV2",                             // Nome do time (se mensagem de time)

  // ============================================
  // TOKENS & CUSTOS
  // ============================================
  "token_total": 1234,                                     // Total de tokens (input + output)
  "tokens": {
    "input": 800,                                          // Tokens de entrada (prompt)
    "output": 434                                          // Tokens de saída (completion)
  },

  // ============================================
  // RAG (Retrieval-Augmented Generation)
  // ============================================
  "rag": true,                                             // Se usou RAG
  "rag_sources": [                                         // Fontes consultadas (máximo 5)
    {
      "collection": "case_a9000_manual",                   // Nome da coleção Qdrant
      "text": "Para purgar o sistema hidráulico...",       // Trecho do chunk
      "score": 0.92,                                       // Score de similaridade
      "metadata": {                                        // Metadata do documento original
        "page": 42,
        "section": "Manutenção Hidráulica"
      }
    }
  ],
  "rag_chunks_count": 5,                                   // Número total de chunks usados

  // ============================================
  // MODELO & PERFORMANCE
  // ============================================
  "model_used": "gpt-4",                                   // Modelo OpenAI usado
  "execution_time_ms": 28798,                              // Tempo de execução em milissegundos

  // ============================================
  // STATUS & ERROS
  // ============================================
  "success": true,                                         // Se a execução foi bem-sucedida
  "error": null,                                           // Mensagem de erro (se houver)

  // ============================================
  // FEEDBACK DO USUÁRIO
  // ============================================
  "feedback": {                                            // Será preenchido quando usuário der feedback
    "rating": 5,                                           // 1-5 stars
    "comment": "Resposta muito útil!",
    "created_at": ISODate("2025-10-03T20:20:00.000Z")
  }
}
```

---

## Tipos de Mensagem

### 1. Mensagem do Usuário (`message_type: "user"`)

```javascript
{
  "mensagem_id": "bf67a9e3-c591-4431-8b82-f91430cc444c",
  "message_type": "user",
  "mensagem": "To com problema no fluxo hidraulico",
  "user_assistant_id": 4,              // ID do usuário
  "agent_name": null,
  "team_id": 3,
  "team_name": "IntelliProV2",
  "token_total": 0,                    // Mensagens do usuário não consomem tokens
  "tokens": {
    "input": 0,
    "output": 0
  },
  "rag": false,
  "rag_sources": [],
  "rag_chunks_count": 0,
  "model_used": "user-input",
  "execution_time_ms": 0,
  "success": true,
  "error": null,
  "feedback": null,
  "created_at": ISODate("2025-10-03T20:13:09.863Z")
}
```

### 2. Mensagem do Coordenador (`message_type: "team"`, `user_assistant_id: "Coordenador"`)

```javascript
{
  "mensagem_id": "a63c81d4-1f7a-434a-aeba-d79c2ec28216",
  "message_type": "team",
  "mensagem": "Para te ajudar melhor, preciso saber qual modelo...",
  "user_assistant_id": "Coordenador",  // String "Coordenador"
  "agent_name": "Coordenador",
  "team_id": 3,
  "team_name": "IntelliProV2",
  "token_total": 450,
  "tokens": {
    "input": 300,
    "output": 150
  },
  "rag": false,
  "rag_sources": [],
  "rag_chunks_count": 0,
  "model_used": "gpt-4",
  "execution_time_ms": 2340,
  "success": true,
  "error": null,
  "feedback": null,
  "created_at": ISODate("2025-10-03T20:13:14.208Z")
}
```

### 3. Mensagem de Agente Especialista (`message_type: "team"`, `user_assistant_id: 7`)

```javascript
{
  "mensagem_id": "9d12baf5-fcbe-43fb-a540-bd856aed970b",
  "message_type": "team",
  "mensagem": "## Procedimento Detalhado para Purga...",
  "user_assistant_id": 7,              // ID numérico do agente
  "agent_name": "agent-7",
  "team_id": 3,
  "team_name": "IntelliProV2",
  "token_total": 3456,
  "tokens": {
    "input": 2100,
    "output": 1356
  },
  "rag": true,                         // Usou RAG
  "rag_sources": [
    {
      "collection": "case_a9000_manual",
      "text": "Para purgar o sistema hidráulico...",
      "score": 0.95
    }
  ],
  "rag_chunks_count": 3,
  "model_used": "gpt-4",
  "execution_time_ms": 28798,
  "success": true,
  "error": null,
  "feedback": null,
  "created_at": ISODate("2025-10-03T20:17:35.902Z")
}
```

---

## Collection: `analytics`

### Analytics Document

```javascript
{
  "_id": ObjectId("..."),
  "analise_id": "uuid-da-analise",
  "session_id": "team-3-1759522381089",  // Referência ao chat_id
  "topico_principal": "manutenção hidráulica",
  "topicos": [
    "sistema hidráulico",
    "purga",
    "Case A9000"
  ],
  "keywords": [
    "fluido hidráulico",
    "válvulas de purga",
    "bomba hidráulica"
  ],
  "sentiment": "neutral",                 // "positive" | "neutral" | "negative"
  "category": "suporte-tecnico",
  "created_at": ISODate("2025-10-03T20:30:00.000Z")
}
```

---

## Índices Recomendados

### Collection `chats`

```javascript
db.chats.createIndex({ "chat_id": 1 }, { unique: true })
db.chats.createIndex({ "customer_id": 1 })
db.chats.createIndex({ "team_id": 1 })
db.chats.createIndex({ "created_at": -1 })
db.chats.createIndex({ "mensagens.user_assistant_id": 1 })
db.chats.createIndex({ "mensagens.created_at": -1 })
```

### Collection `analytics`

```javascript
db.analytics.createIndex({ "analise_id": 1 }, { unique: true })
db.analytics.createIndex({ "session_id": 1 })
db.analytics.createIndex({ "topico_principal": 1 })
db.analytics.createIndex({ "created_at": -1 })
```

---

## Queries Úteis

### 1. Total de tokens por cliente

```javascript
db.chats.aggregate([
  { $match: { customer_id: 123 } },
  { $unwind: "$mensagens" },
  { $group: {
      _id: "$customer_id",
      total_tokens: { $sum: "$mensagens.token_total" },
      total_input: { $sum: "$mensagens.tokens.input" },
      total_output: { $sum: "$mensagens.tokens.output" }
  }}
])
```

### 2. Mensagens que usaram RAG

```javascript
db.chats.aggregate([
  { $unwind: "$mensagens" },
  { $match: { "mensagens.rag": true } },
  { $project: {
      chat_id: 1,
      mensagem_id: "$mensagens.mensagem_id",
      agent_name: "$mensagens.agent_name",
      rag_chunks: "$mensagens.rag_chunks_count",
      created_at: "$mensagens.created_at"
  }}
])
```

### 3. Performance por agente

```javascript
db.chats.aggregate([
  { $unwind: "$mensagens" },
  { $match: { "mensagens.message_type": { $in: ["agent", "team"] } } },
  { $group: {
      _id: "$mensagens.user_assistant_id",
      avg_execution_time: { $avg: "$mensagens.execution_time_ms" },
      avg_tokens: { $avg: "$mensagens.token_total" },
      total_messages: { $sum: 1 },
      success_rate: { $avg: { $cond: ["$mensagens.success", 1, 0] } }
  }}
])
```

### 4. Buscar erros

```javascript
db.chats.aggregate([
  { $unwind: "$mensagens" },
  { $match: { "mensagens.success": false } },
  { $project: {
      chat_id: 1,
      mensagem_id: "$mensagens.mensagem_id",
      error: "$mensagens.error",
      created_at: "$mensagens.created_at"
  }}
])
```

---

## Mudanças do Schema Antigo

### ❌ REMOVIDO
- Campo duplicado: Nenhum

### ✅ ADICIONADO
- `agent_name`: Nome legível do agente
- `team_name`: Nome do time
- `rag_sources`: Array com fontes RAG consultadas
- `rag_chunks_count`: Contador de chunks usados
- `model_used`: Modelo OpenAI usado
- `execution_time_ms`: Tempo de execução
- `success`: Flag de sucesso
- `error`: Mensagem de erro

### 🔄 MODIFICADO
- `user_assistant_id`: Agora pode ser int (user/agent ID) ou string ("Coordenador")
- `tokens`: Agora SEMPRE normalizado no formato `{input: int, output: int}`
- `token_total`: Agora SEMPRE calculado corretamente (não mais zerado)

---

## Notas Importantes

1. **Tokens Zerados**: Com as mudanças, tokens NÃO devem mais aparecer zerados para mensagens de agentes
2. **RAG Sources**: Limitado a 5 sources para evitar documentos muito grandes
3. **Agent ID**: Usar `extract_agent_id()` do `mongo_chat_service.py` para normalizar IDs
4. **Validação**: Sempre usar `validate_and_enrich_metadata()` antes de salvar
5. **Normalização**: Usar `normalize_tokens()` para garantir formato consistente
