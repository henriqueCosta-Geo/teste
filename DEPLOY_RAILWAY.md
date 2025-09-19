# 🚀 Deploy no Railway - Guia Completo

Este guia te ajuda a fazer o deploy da aplicação Qdrant Admin no Railway de forma completa.

## 📋 Pré-requisitos

✅ **Conta Railway com plano pago** (você já tem!)
✅ **Git instalado** no seu computador
✅ **Railway CLI** instalado

### Instalar Railway CLI

```bash
# Via npm
npm install -g @railway/cli

# Ou via curl (Linux/Mac)
curl -fsSL https://railway.app/install.sh | sh
```

## 🗂️ Estrutura do Deploy

Vamos criar **3 serviços separados** no Railway:
1. **PostgreSQL** - Banco de dados
2. **Redis** - Cache e filas
3. **Backend** - API FastAPI (Python)
4. **Frontend** - Interface Next.js

## 📝 Passo a Passo Completo

### 1️⃣ **Preparar o Projeto**

1. **Abra o terminal** na pasta do projeto:
```bash
cd "C:\Users\Henrique\Desktop\python\Qdrant Teste - Versão 3"
```

2. **Inicializar Git** (se ainda não for um repositório):
```bash
git init
git add .
git commit -m "Initial commit"
```

### 2️⃣ **Login no Railway**

```bash
# Fazer login
railway login

# Verificar se está logado
railway whoami
```

### 3️⃣ **Criar Projeto no Railway**

```bash
# Criar novo projeto
railway init qdrant-admin

# Ou usar projeto existente se já criou
railway link
```

### 4️⃣ **Adicionar Serviços de Banco**

1. **Adicionar PostgreSQL:**
```bash
railway add -s postgresql
```

2. **Adicionar Redis:**
```bash
railway add -s redis
```

### 5️⃣ **Deploy do Backend**

1. **Criar serviço backend:**
```bash
railway service create backend
```

2. **Conectar ao serviço backend:**
```bash
railway service connect backend
```

3. **Configurar variáveis do backend:**
```bash
# Variáveis essenciais (substitua pelos seus valores)
railway variables set QDRANT_URL="https://sua-url-qdrant.com"
railway variables set QDRANT_API_KEY="sua-api-key"
railway variables set OPENAI_API_KEY="sua-openai-key"

# As variáveis DATABASE_URL e REDIS_URL serão configuradas automaticamente
```

4. **Deploy do backend:**
```bash
railway up --service backend --dockerfile Dockerfile.backend
```

### 6️⃣ **Deploy do Frontend**

1. **Criar serviço frontend:**
```bash
railway service create frontend
```

2. **Conectar ao serviço frontend:**
```bash
railway service connect frontend
```

3. **Configurar variáveis do frontend:**
```bash
# URL do backend (vai ser algo como https://backend-production-xxxx.up.railway.app)
railway variables set NEXT_PUBLIC_API_URL="https://backend-production-xxxx.up.railway.app"
railway variables set INTERNAL_API_URL="https://backend-production-xxxx.up.railway.app"

# NextAuth
railway variables set NEXTAUTH_SECRET="$(openssl rand -base64 32)"
railway variables set NEXTAUTH_URL="https://frontend-production-xxxx.up.railway.app"

# Database (mesmo do backend)
railway variables set DATABASE_URL="$DATABASE_URL"
```

4. **Deploy do frontend:**
```bash
railway up --service frontend
```

### 7️⃣ **Configurar Domínios Personalizados (Opcional)**

1. **No painel do Railway**, acesse cada serviço
2. **Vá em Settings > Networking**
3. **Configure domínios personalizados** se desejar

### 8️⃣ **Configurar CORS do Backend**

Após obter a URL do frontend, atualize as variáveis do backend:

```bash
# Conectar ao backend
railway service connect backend

# Permitir CORS do frontend
railway variables set CORS_ORIGINS="https://seu-frontend.railway.app,https://seu-dominio.com"
```

## 🔑 **Primeiro Acesso**

Após o deploy completo:

### **Credenciais Padrão:**
- **Super Admin:** `admin@example.com` / `admin123`
- **Demo User:** `demo@example.com` / `demo123`

### **URLs de Acesso:**
- **Frontend:** `https://frontend-production-xxxx.up.railway.app`
- **Backend API:** `https://backend-production-xxxx.up.railway.app`
- **Docs API:** `https://backend-production-xxxx.up.railway.app/docs`

## ⚙️ **Variáveis de Ambiente Completas**

### **Backend Service:**
```env
QDRANT_URL=https://sua-url-qdrant.com
QDRANT_API_KEY=sua-api-key-qdrant
OPENAI_API_KEY=sk-sua-openai-key
DATABASE_URL=postgresql://... (auto)
REDIS_URL=redis://... (auto)
```

### **Frontend Service:**
```env
NEXT_PUBLIC_API_URL=https://backend-production-xxxx.up.railway.app
INTERNAL_API_URL=https://backend-production-xxxx.up.railway.app
DATABASE_URL=postgresql://... (mesmo do backend)
NEXTAUTH_SECRET=string-aleatoria-segura
NEXTAUTH_URL=https://frontend-production-xxxx.up.railway.app
```

## 🔍 **Verificar Deploy**

### **Logs dos Serviços:**
```bash
# Ver logs do backend
railway logs --service backend

# Ver logs do frontend
railway logs --service frontend

# Ver logs do PostgreSQL
railway logs --service postgresql
```

### **Status dos Serviços:**
```bash
railway status
```

## 🐛 **Resolução de Problemas**

### **Backend não conecta ao banco:**
1. Verifique se `DATABASE_URL` está configurada
2. Aguarde alguns minutos para o PostgreSQL inicializar
3. Verifique logs: `railway logs --service backend`

### **Frontend não carrega:**
1. Verifique se `NEXT_PUBLIC_API_URL` está correto
2. Aguarde o build completar (~5-10 minutos)
3. **Se der erro de webpack:** O build foi otimizado para resolver problemas do Railway
4. Verifique logs: `railway logs --service frontend`

### **Erro de build do Next.js:**
1. **Telemetry desabilitado:** Para builds mais rápidos
2. **Webpack worker habilitado:** Para resolver avisos do Railway
3. **Output standalone:** Para melhor performance no Railway

### **CORS errors:**
1. Atualize `CORS_ORIGINS` no backend
2. Certifique-se que as URLs estão corretas

### **Usuário admin não existe:**
1. O usuário é criado automaticamente no startup
2. Verifique logs do backend para confirmação
3. Se necessário, conecte ao banco e execute:
```sql
SELECT * FROM users WHERE role = 'SUPER_USER';
```

## 🔄 **Atualizações Futuras**

Para atualizar o código:

```bash
# Fazer commit das mudanças
git add .
git commit -m "Update: descrição das mudanças"

# Deploy backend
railway up --service backend --dockerfile Dockerfile.backend

# Deploy frontend
railway up --service frontend
```

## 📊 **Monitoramento**

1. **Painel Railway:** https://railway.app/dashboard
2. **Métricas:** Cada serviço mostra CPU, RAM, rede
3. **Logs:** Disponíveis em tempo real no painel
4. **Alertas:** Configure notificações para falhas

## ✅ **Checklist Final**

- [ ] PostgreSQL rodando
- [ ] Redis rodando
- [ ] Backend respondendo em `/status`
- [ ] Frontend carregando
- [ ] Login com admin@example.com funciona
- [ ] APIs de teams/agents funcionando
- [ ] Upload de logos funciona
- [ ] Chat com agents funciona

---

🎉 **Pronto!** Sua aplicação está no ar no Railway!