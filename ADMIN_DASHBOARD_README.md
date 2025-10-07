# 📊 Dashboard de Administração - Documentação

Sistema completo de dashboard administrativo com **data enriching** entre MongoDB (NoSQL) e PostgreSQL (SQL).

## 🎯 Funcionalidades

### ✅ Implementado

- ✅ **Visão Geral**: Métricas gerais do customer (usuários, chats, mensagens)
- ✅ **Consumo de Tokens**: Análise completa de uso de tokens por modelo e agente
- ✅ **Performance de Agentes**: Métricas de execução, sucesso e RAG usage
- ✅ **Insights de Conversas**: Análise de atividade de usuários e times
- ✅ **RAG Analytics**: Estatísticas de uso de RAG e collections
- ✅ **Qualidade & Erros**: Monitoramento de erros e queries lentas
- ✅ **Filtros de Período**: 7, 30, 90, 365 dias
- ✅ **Export JSON**: Download dos dados do dashboard

---

## 🏗️ Arquitetura

### Backend (`/backend/admin_endpoints.py`)

**Endpoint Principal:**
```
GET /api/admin/dashboard/{customer_id}?days_back=30
```

**Funções de Agregação MongoDB:**
- `aggregate_overview_metrics()` - Métricas gerais
- `aggregate_token_consumption()` - Consumo de tokens
- `aggregate_agent_performance()` - Performance dos agentes
- `aggregate_conversation_insights()` - Insights de conversas
- `aggregate_rag_analytics()` - Analytics de RAG
- `aggregate_quality_metrics()` - Métricas de qualidade

**Data Enriching:**
- MongoDB: Dados de conversas, tokens, RAG, performance
- PostgreSQL: Informações de customers, users, agents, teams, collections

### Frontend

**Estrutura de Componentes:**
```
frontend/src/
├── lib/
│   ├── admin-types.ts          # TypeScript types
│   └── admin-api.ts            # API client
├── components/admin/
│   ├── CustomerDashboard.tsx   # Componente principal
│   ├── DashboardFilters.tsx    # Filtros de período
│   └── sections/
│       ├── OverviewSection.tsx
│       ├── TokenConsumptionSection.tsx
│       ├── AgentsPerformanceSection.tsx
│       ├── ConversationInsightsSection.tsx
│       ├── RAGAnalyticsSection.tsx
│       └── QualityMetricsSection.tsx
└── app/admin/dashboard/[customerId]/
    └── page.tsx                # Rota do dashboard
```

---

## 📋 Como Usar

### 1. Acessar o Dashboard

**Rota Frontend:**
```
/admin/dashboard/{customer_id}
```

**Exemplo:**
```
http://localhost:3000/admin/dashboard/13
```

### 2. Permissões

**Requer:**
- Role: `ADMIN` ou `SUPER_USER`
- `ADMIN`: pode ver apenas o próprio customer
- `SUPER_USER`: pode ver qualquer customer

### 3. Filtros Disponíveis

- **Últimos 7 dias**
- **Últimos 30 dias** (padrão)
- **Últimos 90 dias**
- **Último ano** (365 dias)

### 4. Exportar Dados

Clique no botão **"Exportar"** para baixar um arquivo JSON com todos os dados do dashboard.

---

## 📊 Métricas Disponíveis

### 1. Visão Geral
- Total de usuários (ativos/inativos)
- Total de chats no período
- Total de mensagens
- Média de mensagens por chat
- Informações do plano

### 2. Consumo de Tokens
- Total de tokens (input/output)
- Breakdown por modelo (GPT-4, GPT-4o-mini, etc.)
- Breakdown por agente
- Custo estimado (USD)
- Tokens médios por mensagem

### 3. Performance dos Agentes
- Total de mensagens por agente
- Tempo médio de execução
- Taxa de sucesso
- Número de erros
- Taxa de uso de RAG
- Média de chunks por query
- Número de collections vinculadas

### 4. Insights de Conversas
- Usuários mais ativos
- Mensagens enviadas por usuário
- Time favorito de cada usuário
- Times mais utilizados
- Usuários únicos por time

### 5. RAG Analytics
- Total de queries com RAG
- Taxa de uso de RAG (%)
- Score médio de similaridade
- Fontes mais consultadas
- Estatísticas de collections (arquivos, chunks, queries)

### 6. Qualidade & Erros
- Taxa de sucesso global
- Total de mensagens bem-sucedidas/falhas
- Lista de erros recentes (últimos 20)
- Queries mais lentas (>15s)
- Detalhes de cada erro/query lenta

---

## 🔧 Exemplos de Uso

### Exemplo 1: Verificar consumo de um customer específico

```bash
curl -X GET "http://localhost:8000/api/admin/dashboard/13?days_back=30" \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json"
```

**Resposta:**
```json
{
  "overview": {
    "customer_id": 13,
    "customer_name": "Empresa XYZ",
    "plan_type": "PROFESSIONAL",
    "total_users": 5,
    "active_users": 3,
    "total_chats": 142,
    "total_messages": 1823,
    "period_days": 30
  },
  "token_consumption": {
    "total_tokens": 234750,
    "input_tokens": 156820,
    "output_tokens": 77930,
    "by_model": {
      "gpt-4": {
        "tokens": 180000,
        "messages": 156,
        "cost": 45.00
      }
    },
    "estimated_cost": 46.37
  },
  ...
}
```

### Exemplo 2: Usar no Frontend

```typescript
import { adminAPI } from '@/lib/admin-api'

// Carregar dashboard
const data = await adminAPI.getDashboard(13, 30)

// Exportar dados
const blob = await adminAPI.exportDashboardJSON(13, 30)
adminAPI.downloadExport(blob, 'dashboard-customer-13.json')
```

---

## 🎨 Customização

### Adicionar Nova Seção

1. **Criar função de agregação no backend:**

```python
async def aggregate_my_metric(
    mongo_chat_service: MongoChatService,
    customer_id: int,
    start_date: datetime,
    end_date: datetime,
    db: Session
) -> Dict[str, Any]:
    # Sua lógica aqui
    return {"metric": value}
```

2. **Adicionar ao endpoint:**

```python
my_data = await aggregate_my_metric(
    mongo_chat_service, customer_id, start_date, end_date, db
)
```

3. **Criar componente React:**

```tsx
// frontend/src/components/admin/sections/MySection.tsx
export default function MySection({ data }) {
  return <div>{/* Sua UI */}</div>
}
```

4. **Adicionar ao CustomerDashboard:**

```tsx
<MySection data={data.my_metric} />
```

---

## 🐛 Troubleshooting

### Erro: "Acesso negado"
- Verificar se usuário tem role ADMIN ou SUPER_USER
- Verificar se ADMIN está tentando acessar outro customer

### Erro: "Customer não encontrado"
- Verificar se `customer_id` existe no PostgreSQL
- Verificar permissões de acesso

### Dashboard vazio
- Verificar se há chats no MongoDB para o customer
- Verificar período selecionado (pode não ter dados)
- Verificar logs do backend para erros de agregação

### Performance lenta
- Considerar adicionar índices no MongoDB:
  ```javascript
  db.chats.createIndex({ "customer_id": 1, "created_at": -1 })
  ```
- Reduzir `limit` nas queries (padrão: 10000)
- Implementar cache (Redis) para dashboards acessados frequentemente

---

## 🚀 Próximas Melhorias

- [ ] **Gráficos visuais** (Chart.js, Recharts)
- [ ] **Comparação de períodos** (mês atual vs anterior)
- [ ] **Alertas automáticos** (email quando taxa de erro > 5%)
- [ ] **Export CSV** (além de JSON)
- [ ] **Filtros avançados** (por agente, team, usuário)
- [ ] **Cache Redis** para otimizar queries pesadas
- [ ] **Webhooks** para notificações em tempo real
- [ ] **Dashboard em tempo real** (WebSockets)

---

## 📞 Suporte

Para dúvidas ou problemas, consulte os logs:

**Backend:**
```bash
docker logs backend
```

**Frontend:**
```bash
cd frontend && npm run dev
```

---

**Desenvolvido com ❤️ usando FastAPI, Next.js, MongoDB e PostgreSQL**
