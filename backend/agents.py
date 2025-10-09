"""
Módulo de Integração Agno + Qdrant RAG
Gerenciamento de agentes IA com acesso controlado a bases de conhecimento
"""

import os
import json
import time
import logging
import re
from typing import List, Dict, Any, Optional
from datetime import datetime
from dotenv import load_dotenv

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Carregar variáveis de ambiente
load_dotenv()

from agno.agent import Agent
from agno.team import Team  # ✅ Nova importação para criar teams
from agno.models.openai import OpenAIChat
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.reasoning import ReasoningTools
from agno.db.postgres import PostgresDb  # ✅ Storage para persistir sessão e histórico
from agno.memory import MemoryManager  # ✅ Gerenciador de memória

from sqlalchemy.orm import Session
from sqlalchemy import text
from agent_models import AgentTeam, TeamMember, Agent as AgentModel

# Verificar se a API key está configurada
if not os.getenv('OPENAI_API_KEY'):
    raise ValueError("OPENAI_API_KEY not set. Please set the OPENAI_API_KEY environment variable.")


class QdrantRAGTool:
    """
    Ferramenta customizada para integração Agno + Qdrant
    Permite que agentes busquem em coleções específicas
    """

    def __init__(self, qdrant_service, allowed_collections: List[str], db: Session):
        self.qdrant_service = qdrant_service
        self.allowed_collections = allowed_collections
        self.db = db
        self.search_history = []

    def search(self, query: str, collection_name: str = None, limit: int = 5) -> List[Dict]:
        """
        Busca semântica em coleções Qdrant permitidas

        Args:
            query: Pergunta ou termo de busca
            collection_name: Nome específico da coleção (opcional)
            limit: Número máximo de resultados

        Returns:
            Lista de chunks relevantes com scores
        """
        logger.info(f"🔎 [RAG] BUSCA INICIADA: '{query[:100]}...'")
        logger.info(f"🗄️ [RAG] COLEÇÕES PERMITIDAS: {self.allowed_collections}")
        
        # Validar acesso à coleção
        if collection_name and collection_name not in self.allowed_collections:
            error_msg = f"Acesso negado à coleção '{collection_name}'"
            logger.error(f"❌ [RAG] {error_msg}")
            return [{
                "error": error_msg,
                "allowed_collections": self.allowed_collections
            }]

        results = []
        collections_to_search = [collection_name] if collection_name else self.allowed_collections
        logger.info(f"🎯 [RAG] BUSCANDO EM: {collections_to_search}")

        # Buscar em cada coleção permitida
        for coll_name in collections_to_search:
            try:
                logger.info(f"   📚 [RAG] BUSCANDO NA COLEÇÃO: {coll_name}")
                coll_results = self.qdrant_service.search_similar_chunks(
                    coll_name,
                    query,
                    limit
                )

                logger.info(f"   ✅ [RAG] {len(coll_results)} resultados encontrados em {coll_name}")

                # Adicionar metadados da coleção
                for result in coll_results:
                    result['collection'] = coll_name
                    result['search_query'] = query

                results.extend(coll_results)

            except Exception as e:
                logger.error(f"   ❌ [RAG] ERRO na coleção {coll_name}: {e}")
                continue

        # Ordenar por score (maior primeiro)
        results.sort(key=lambda x: x.get('score', 0), reverse=True)
        
        logger.info(f"🏆 [RAG] TOTAL DE RESULTADOS: {len(results)} (limitado a {limit})")
        if results:
            logger.info(f"📊 [RAG] MELHOR SCORE: {results[0].get('score', 0):.4f}")

        # Registrar busca
        search_record = {
            "query": query,
            "collections_searched": collections_to_search,
            "results_count": len(results),
            "timestamp": datetime.now().isoformat(),
            "top_results": [{"content": r.get('text', '')[:200] + '...', "score": r.get('score', 0)} for r in results[:3]]
        }
        self.search_history.append(search_record)

        final_results = results[:limit]
        logger.info(f"✅ [RAG] RETORNANDO {len(final_results)} RESULTADOS FINAIS")
        
        # Log para captura posterior na UI
        if final_results:
            logger.info(f"📋 [RAG-RESULTS] QUERY: {query[:100]}")
            logger.info(f"📋 [RAG-RESULTS] COLLECTIONS: {collections_to_search}")
            logger.info(f"📋 [RAG-RESULTS] COUNT: {len(final_results)}")
            for i, result in enumerate(final_results[:3]):
                logger.info(f"📋 [RAG-RESULTS] #{i+1}: {result.get('text', '')[:150]}... (score: {result.get('score', 0):.3f})")
        
        return final_results

    def get_collection_stats(self, collection_name: str) -> Dict:
        """Obter estatísticas de uma coleção"""
        if collection_name not in self.allowed_collections:
            return {"error": "Acesso negado"}

        return self.qdrant_service.get_collection_info(collection_name)


class AgentManager:
    """
    Gerenciador central de agentes Agno
    Responsável por criar, configurar e executar agentes
    """

    def __init__(self, db: Session, qdrant_service):
        self.db = db
        self.qdrant_service = qdrant_service
        self.active_agents = {}  # Cache de agentes ativos
        self.active_teams = {}  # ✅ Cache de teams ativos por session_id
        self.execution_history = []

        # ✅ Configurar PostgresDb e MemoryManager para persistir contexto
        database_url = os.getenv("DATABASE_URL")
        logger.info(f"🔍 [AGNO-DB] DATABASE_URL lida do .env: {database_url}")

        if database_url:
            try:
                logger.info(f"🔄 [AGNO-DB] Tentando criar PostgresDb com URL: {database_url}")
                self.agno_db = PostgresDb(db_url=database_url)  # ✅ Parâmetro correto: db_url
                logger.info(f"✅ [AGNO-DB] PostgresDb criado com sucesso: {self.agno_db}")

                self.memory_manager = MemoryManager(db=self.agno_db)
                logger.info(f"✅ [AGNO-DB] MemoryManager criado com sucesso: {self.memory_manager}")

                logger.info("✅ PostgresDb e MemoryManager configurados para persistir contexto")
            except Exception as e:
                logger.error(f"❌ Erro ao configurar PostgresDb: {e}")
                logger.error(f"❌ Traceback completo:", exc_info=True)
                self.agno_db = None
                self.memory_manager = None
        else:
            logger.warning("⚠️ DATABASE_URL não configurada - contexto não será persistido")
            self.agno_db = None
            self.memory_manager = None

        logger.info(f"📊 [AGNO-DB] Estado final - agno_db: {self.agno_db}, memory_manager: {self.memory_manager}")

    def get_agent_collections(self, agent_id: int) -> List[Dict]:
        """
        Retorna coleções que o agente pode acessar com seus níveis de permissão
        """
        query = text("""
            SELECT c.name, c.id, ac.access_level, ac.priority
            FROM collections c
            JOIN agent_collections ac ON c.id = ac.collection_id
            WHERE ac.agent_id = :agent_id
            ORDER BY ac.priority DESC
        """)

        result = self.db.execute(query, {"agent_id": agent_id})
        collections = []

        for row in result:
            collection_data = {
                "name": row.name,
                "id": row.id,
                "access_level": row.access_level,
                "priority": row.priority
            }
            collections.append(collection_data)

        if not collections:
            logger.debug(f"[AGENT-{agent_id}] Nenhuma coleção RAG encontrada")
        else:
            logger.info(f"✅ [AGENT-{agent_id}] ENCONTRADAS {len(collections)} COLEÇÕES RAG")

        return collections

    # agents.py  (dentro de AgentManager)
    def stream_team_task_with_context(self, team_id: int, task: str, context_history: list | None = None, session_id: str = None):
        """
        Executa a tarefa para um time de agentes emitindo eventos de streaming (para SSE).
        Rende dicts já no formato esperado pelo frontend (type, message/content, agent_name...).

        Args:
            team_id: ID do time
            task: Tarefa
            context_history: Histórico (para construir contexto textual)
            session_id: ID da sessão - CRÍTICO para manter memória do Team
        """
        context_history = context_history or []
        try:
            # ==== carrega time, membros e líder (mesma lógica do método com retorno "não stream") ====
            team = self.db.query(AgentTeam).filter(AgentTeam.id == team_id).first()
            if not team:
                yield {"type": "error", "message": f"Time {team_id} não encontrado"}
                return

            # membros (exclui líder) — mesma query usada hoje
            team_members_query = self.db.query(
                TeamMember.agent_id,
                AgentModel.name,
                AgentModel.description,
                AgentModel.role,
                AgentModel.model,
                AgentModel.temperature,
                AgentModel.instructions,
                AgentModel.tools_config
            ).join(AgentModel, TeamMember.agent_id == AgentModel.id).filter(
                TeamMember.team_id == team_id,
                AgentModel.is_active == True,
                TeamMember.agent_id != team.leader_agent_id
            )

            team_members = []
            for r in team_members_query:
                team_members.append({
                    "id": r.agent_id, "name": r.name, "description": r.description, "role": r.role,
                    "model": r.model, "temperature": r.temperature, "instructions": r.instructions,
                    "tools_config": r.tools_config or []
                })

            if not team_members:
                yield {"type": "error", "message": f"Nenhum membro ativo no time {team_id}"}
                return

            leader_config = None
            if team.leader_agent_id:
                leader = self.db.query(AgentModel).filter(
                    AgentModel.id == team.leader_agent_id, AgentModel.is_active == True
                ).first()
                if leader:
                    leader_config = {
                        "id": leader.id, "name": leader.name, "description": leader.description, "role": leader.role,
                        "model": leader.model, "temperature": leader.temperature,
                        "instructions": leader.instructions, "tools_config": leader.tools_config or []
                    }
            if not leader_config:
                yield {"type": "error", "message": f"Líder do time {team_id} não encontrado ou inativo"}
                return

            # contexto enriquecido (mesma função usada hoje)
            team_context = self._build_team_context(
                team=team, leader=leader_config, members=team_members, task=task, history=context_history
            )

            team_agent = self._create_team_agent(team_id=team_id, leader_config=leader_config, team_members=team_members, team_context=team_context, session_id=session_id)

            # sinaliza início
            yield {"type": "start", "team_id": team_id, "team_name": team.name}

            # executa com o Agno
            logger.info(f"💾 [STREAM TIME-{team_id}] SESSION_ID: {session_id}")

            # ✅ Executar com session_id, user_id e flags de histórico
            if session_id:
                response = team_agent.run(
                    task,
                    session_id=session_id,
                    user_id=None,
                    add_history_to_context=True,
                    num_history_runs=6
                )
            else:
                logger.warning(f"⚠️ [STREAM TIME-{team_id}] SESSION_ID NÃO FORNECIDO!")
                response = team_agent.run(task)

            # 3 casos: RunResponse com .content; generator (event stream); ou string
            final_text = ""
            delegated_agent_name = None

            # a) objeto com .content
            if hasattr(response, "content"):
                final_text = response.content or ""
                yield {"type": "content", "content": final_text, "agent_name": leader_config["name"]}

            # b) iterável/generator (stream real)
            elif hasattr(response, "__iter__"):
                for event in response:
                    etype = type(event).__name__
                    # conteúdo parcial
                    if hasattr(event, "content") and getattr(event, "content"):
                        chunk = str(event.content)
                        final_text += chunk
                        yield {"type": "content", "content": chunk, "agent_name": delegated_agent_name}
                    # tentativa de detectar delegação via ToolCallStartedEvent (compatível com tua lógica atual)
                    if "ToolCallStartedEvent" in etype:
                        tool = getattr(event, "tool", None)
                        tool_args = getattr(tool, "tool_args", {}) if tool else {}
                        maybe_agent = None
                        if isinstance(tool_args, dict):
                            maybe_agent = tool_args.get("agent_name") or tool_args.get("member") or tool_args.get("member_id")
                        if maybe_agent:
                            delegated_agent_name = maybe_agent
                            yield {"type": "progress", "message": f"Delegando para {maybe_agent}..."}

            # c) fallback para string
            else:
                final_text = str(response)
                if final_text:
                    yield {"type": "content", "content": final_text, "agent_name": leader_config["name"]}

            # fim
            yield {"type": "completed", "content": final_text, "agent_name": delegated_agent_name or leader_config["name"]}

        except Exception as e:
            yield {"type": "error", "message": str(e)}


    def create_agent_instance(self, agent_config: Dict) -> Agent:
        """
        Cria instância configurada de um agente Agno
        """
        agent_id = agent_config.get('id')

        # Verificar cache
        if agent_id in self.active_agents:
            return self.active_agents[agent_id]

        # Buscar coleções permitidas
        agent_collections = self.get_agent_collections(agent_id)
        allowed_collection_names = [c['name'] for c in agent_collections]

        # Criar ferramenta RAG customizada
        rag_tool = QdrantRAGTool(
            self.qdrant_service,
            allowed_collection_names,
            self.db
        )

        # Configurar ferramentas do agente
        tools = []

        # RAG é sempre incluído
        tools.append(rag_tool.search)

        # Adicionar ferramentas extras conforme configuração
        tools_config = agent_config.get('tools_config', [])

        if isinstance(tools_config, str):
            tools_config = json.loads(tools_config) if tools_config else []

        if 'web_search' in tools_config:
            tools.append(DuckDuckGoTools())

        if 'reasoning' in tools_config:
            tools.append(ReasoningTools())

        # Preparar instruções com contexto das coleções
        base_instructions = agent_config.get('instructions', '')

        if allowed_collection_names:
            logger.info(f"📋 [AGENT-{agent_id}] ADICIONANDO CONTEXTO RAG ÀS INSTRUÇÕES")
            collections_context = f"""
🗄️ BASES DE CONHECIMENTO DISPONÍVEIS:
{chr(10).join([f"• {name}" for name in allowed_collection_names])}

🔍 INSTRUÇÕES RAG:
- Use a função 'search' para buscar informações nessas bases
- Sempre busque primeiro nas bases antes de dar respostas genéricas  
- Cite as fontes específicas quando usar informações das bases
- Se não encontrar informações relevantes, diga claramente que consultou as bases

            """
            full_instructions = f"{collections_context}\n\n{base_instructions}"
            logger.info(f"✅ [AGENT-{agent_id}] INSTRUÇÕES ATUALIZADAS COM {len(allowed_collection_names)} COLEÇÕES RAG")
        else:
            full_instructions = base_instructions
            logger.info(f"⚠️ [AGENT-{agent_id}] AGENTE SEM ACESSO A COLEÇÕES RAG")

        # Listar ferramentas disponíveis para logging
        tool_names = []
        if tools:
            for tool in tools:
                if hasattr(tool, '__name__'):
                    tool_names.append(tool.__name__)
                elif hasattr(tool, 'name'):
                    tool_names.append(tool.name)
                else:
                    tool_names.append(str(type(tool).__name__))
        
        logger.info(f"🔧 [AGENT-{agent_id}] FERRAMENTAS DISPONÍVEIS: {tool_names}")
        logger.info(f"📝 [AGENT-{agent_id}] TAMANHO DAS INSTRUÇÕES: {len(full_instructions)} caracteres")

        # Criar agente Agno
        agent = Agent(
            name=agent_config.get('name', 'Assistant'),
            role=agent_config.get('role', 'AI Assistant'),
            model=OpenAIChat(
                id=agent_config.get('model', 'gpt-4o-mini'),
                temperature=agent_config.get('temperature', 0.7)
            ),
            tools=tools,
            instructions=full_instructions,
            markdown=True,
            structured_outputs=True,
            stream=True
        )

        # Cachear agente
        self.active_agents[agent_id] = agent
        logger.info(f"✅ [AGENT-{agent_id}] AGENTE CRIADO E CACHEADO: {agent_config.get('name')}")

        return agent

    def execute_agent_task(
            self,
            agent_config: Dict,
            task: str,
            session_id: Optional[str] = None
    ) -> Dict:
        """
        Executa uma tarefa com um agente específico
        """
        start_time = time.time()

        # Criar/recuperar agente
        agent = self.create_agent_instance(agent_config)

        try:
            # Executar tarefa
            response = agent.run(task)

            # Processar resposta
            if hasattr(response, 'content'):
                response_content = response.content
            else:
                response_content = str(response)

            # Extrair ferramentas usadas
            tools_used = []
            if hasattr(response, 'messages') and response.messages:
                for msg in response.messages:
                    if hasattr(msg, 'tool_calls') and msg.tool_calls:
                        tools_used.extend([tc.name for tc in msg.tool_calls if hasattr(tc, 'name')])

            execution_time = int((time.time() - start_time) * 1000)

            # Registrar execução
            execution_record = {
                "agent_id": agent_config.get('id'),
                "agent_name": agent_config.get('name'),
                "task": task,
                "response": response_content,
                "tools_used": list(set(tools_used)),
                "execution_time_ms": execution_time,
                "session_id": session_id,
                "timestamp": datetime.now().isoformat(),
                "success": True
            }

            self.execution_history.append(execution_record)

            return execution_record

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)

            error_record = {
                "agent_id": agent_config.get('id'),
                "agent_name": agent_config.get('name'),
                "task": task,
                "error": str(e),
                "execution_time_ms": execution_time,
                "session_id": session_id,
                "timestamp": datetime.now().isoformat(),
                "success": False
            }

            self.execution_history.append(error_record)

            return error_record

    def create_agent_team(
            self,
            team_members: List[Dict],
            team_leader_config: Optional[Dict] = None
    ) -> Agent:
        """
        Cria um time de agentes que colaboram em tarefas
        """
        # Criar instâncias dos membros do time
        member_agents = []

        for member_config in team_members:
            agent = self.create_agent_instance(member_config)
            member_agents.append(agent)

        # Configurar líder do time
        if team_leader_config:
            logger.info(f"🏆 CRIANDO TIME COM LÍDER: {team_leader_config.get('name')} (ID: {team_leader_config.get('id')})")
            # Usar o agente líder configurado na UI
            leader_agent = self.create_agent_instance(team_leader_config)
            logger.info(f"📋 INSTRUÇÕES ORIGINAIS DO LÍDER: {leader_agent.instructions[:150] if leader_agent.instructions else 'NENHUMA'}...")
            
            # Criar contexto detalhado sobre os membros do time
            team_context = "\n\n=== VOCÊ É O LÍDER DESTE TIME ===\n"
            team_context += "Membros do seu time:\n"
            
            for i, member_config in enumerate(team_members, 1):
                member_collections = self.get_agent_collections(member_config.get('id', 0))
                collections_info = ", ".join([c.get('name', '') for c in member_collections]) if member_collections else "Nenhuma"
                
                tools_config = member_config.get('tools_config', [])
                if isinstance(tools_config, str):
                    tools_config = json.loads(tools_config) if tools_config else []
                tools_info = ", ".join(tools_config) if tools_config else "RAG"
                
                member_instructions = member_config.get('instructions', '')
                speciality = member_instructions[:200] + "..." if len(member_instructions) > 200 else member_instructions
                
                team_context += f"""
{i}. {member_config.get('name', 'Agente')} ({member_config.get('role', 'Assistente')})
   - Especialidade: {speciality or 'Assistente geral'}
   - Bases de conhecimento: {collections_info}
   - Ferramentas: {tools_info}
"""
            
            # Criar mapeamento de modelos para especialistas
            model_mapping = {}
            for member_config in team_members:
                member_name = member_config.get('name', '')
                if 'CH570' in member_name or 'CH670' in member_name:
                    model_mapping['CH570'] = member_name
                    model_mapping['CH670'] = member_name
                elif 'A9000' in member_name:
                    model_mapping['A9000'] = member_name
                elif 'A8000' in member_name or 'A8800' in member_name:
                    model_mapping['A8000'] = member_name
                    model_mapping['A8800'] = member_name
                elif 'CH950' in member_name:
                    model_mapping['CH950'] = member_name
            
            available_models = list(model_mapping.keys())
            
            team_context += f"""

🎯 INSTRUÇÕES DE TRIAGEM OBRIGATÓRIAS:

**SUA FUNÇÃO:** Você é um COORDENADOR DE TRIAGEM, não um técnico.

**REGRA #1 - MÁQUINA ESPECIFICADA:**
Se o usuário mencionar um modelo específico ({', '.join(available_models)}):
- IMEDIATAMENTE delegue para o especialista correto
- Use: "Vou encaminhar para [NOME_ESPECIALISTA] que é expert neste modelo"
- Mapeamento disponível: {model_mapping}

**REGRA #2 - MÁQUINA NÃO ESPECIFICADA:**
Se o usuário NÃO especificar a máquina:
- PARE! NÃO tente responder tecnicamente
- Responda: "Para te ajudar melhor, preciso saber qual máquina específica. Temos especialistas em: {', '.join(available_models)}. Qual modelo você está usando?"
- NUNCA dê respostas técnicas genéricas

**EXEMPLOS PRÁTICOS:**
- "Problema na CH570" → Delegar para {model_mapping.get('CH570', 'Especialista CH570')}
- "Freios com problema" → Perguntar: "Em qual máquina? ({', '.join(available_models[:3])}...)"

**PROIBIDO:**
- Responder perguntas técnicas sozinho
- Dar soluções genéricas
- Tentar adivinhar a máquina
"""
            
            # Preservar instruções originais do líder
            original_instructions = leader_agent.instructions or ""
            full_instructions = original_instructions + team_context
            
            logger.info(f"📏 TAMANHO INSTRUÇÕES ORIGINAIS: {len(original_instructions)} chars")
            logger.info(f"📏 TAMANHO CONTEXTO DO TIME: {len(team_context)} chars") 
            logger.info(f"📏 TAMANHO INSTRUÇÕES FINAIS: {len(full_instructions)} chars")
            logger.info(f"🗺️ MAPEAMENTO DE MODELOS: {model_mapping}")
            logger.info(f"🔧 CONTEXTO DE TRIAGEM GERADO: {team_context[-800:]}")
            logger.info(f"👥 MEMBROS NO TIME: {len(team_members)} - {[m.get('name') for m in team_members]}")
            
            # Criar time com o líder específico usando a nova classe Team
            team = Team(
                name=leader_agent.name,
                role=leader_agent.role,
                members=member_agents,
                model=leader_agent.model,
                instructions=full_instructions,
                markdown=True,
                stream=True
            )
        else:
            # Fallback para líder genérico se não especificado
            leader_model = OpenAIChat(id='gpt-4o-mini')

            team = Team(
                members=member_agents,
                model=leader_model,
                instructions=[
                    "Coordene os agentes do time para resolver a tarefa",
                    "Distribua subtarefas baseado nas especialidades de cada agente",
                    "Sintetize as respostas em uma solução coerente",
                    "Sempre cite qual agente contribuiu com cada parte da resposta"
                ],
                markdown=True,
                stream=True
            )

        return team

    def execute_team_task(
            self,
            team_members: List[Dict],
            task: str,
            team_leader_config: Optional[Dict] = None
    ) -> Dict:
        """
        Executa tarefa com um time de agentes
        """
        start_time = time.time()

        try:
            # Criar time
            team = self.create_agent_team(team_members, team_leader_config)
            
            logger.info(f"⚡ INICIANDO EXECUÇÃO DA TAREFA: {task}")
            logger.info(f"🤖 AGENTE LÍDER: {team.name} com {len(team.instructions) if hasattr(team, 'instructions') else 'sem'} chars de instruções")

            # Executar tarefa
            response = team.run(task)

            logger.info(f"📨 RESPOSTA COMPLETA: {str(response)}")

            # Processar resposta - verificar se é generator (streaming)
            if hasattr(response, '__iter__') and not hasattr(response, 'content'):
                # É um generator - processar para obter resposta completa
                full_response = ""
                for chunk in response:
                    if hasattr(chunk, 'content'):
                        full_response += chunk.content
                    else:
                        full_response += str(chunk)
                response_content = full_response
                logger.info(f"📨 RESPOSTA PROCESSADA DO GENERATOR: {response_content[:200]}...")
            elif hasattr(response, 'content'):
                response_content = response.content
            else:
                response_content = str(response)

            # Verificar se houve delegação (múltiplas mensagens)
            if hasattr(response, 'messages') and response.messages:
                logger.info(f"💬 NÚMERO DE MENSAGENS NA CONVERSA: {len(response.messages)}")
                for i, msg in enumerate(response.messages):
                    logger.info(f"  MSG {i+1}: {str(msg)[:200]}...")
            else:
                logger.info(f"⚠️ RESPOSTA SEM MENSAGENS DETALHADAS")

            execution_time = int((time.time() - start_time) * 1000)

            return {
                "task": task,
                "team_response": response_content,
                "agents_involved": [m.get('name') for m in team_members],
                "execution_time_ms": execution_time,
                "success": True,
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)

            return {
                "task": task,
                "error": str(e),
                "agents_involved": [m.get('name') for m in team_members],
                "execution_time_ms": execution_time,
                "success": False,
                "timestamp": datetime.now().isoformat()
            }

    def _extract_keywords(self, member: Dict, log_details: bool = False) -> List[str]:
        """Extrai keywords de máquinas das descrições dos agentes"""
        name = member.get('name', '')
        role = member.get('role', '')
        description = member.get('description', '')
        text = f"{name} {role} {description}".lower()

        # Padrões comuns de máquinas
        patterns = [
            r'ch\s*\d+',  # CH570, CH 570
            r'a\s*\d+',   # A9000, A 9000
            r'\d{3,5}',   # 570, 9000
        ]

        keywords = []
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            keywords.extend([m.replace(' ', '') for m in matches])

        unique_keywords = list(set(keywords))

        # LOG apenas se requisitado (evitar logs repetidos)
        if log_details and unique_keywords:
            logger.info(f"🔍 [KEYWORDS] {name}: {unique_keywords}")

        return unique_keywords

    def _format_collections(self, collections: List[Dict]) -> str:
        """Formata descrição das coleções disponíveis"""
        if not collections:
            return "Nenhuma base de conhecimento disponível."

        formatted = []
        for col in collections:
            desc = col.get('description', 'Base de conhecimento técnico')
            formatted.append(f"- **{col['name']}**: {desc}")

        return '\n'.join(formatted)

    def _format_specialists(self, specialists: List[Dict]) -> str:
        """Formata especialistas de forma clara para o líder"""
        formatted = []

        for spec in specialists:
            keywords = self._extract_keywords(spec)
            agent_collections = self.get_agent_collections(spec['id'])

            formatted.append(f"""
### {spec['name']}
- **Papel:** {spec['role']}
- **Especialidade:** {spec.get('description', 'Especialista técnico')}
- **Atende sobre:** {', '.join(keywords) if keywords else 'Consultas gerais'}
- **Bases de conhecimento:** {len(agent_collections)} coleção(ões) disponível(is)
""")

        return '\n'.join(formatted)

    def _build_specialist_mapping(self, specialists: List[Dict]) -> str:
        """Cria tabela de mapeamento máquina → especialista"""
        mapping_lines = []

        logger.info(f"📊 [CONSTRUINDO MAPEAMENTO] Total de especialistas: {len(specialists)}")

        for spec in specialists:
            keywords = self._extract_keywords(spec, log_details=True)  # Log apenas aqui

            if keywords:
                # Criar variações comuns
                variations = set()
                for kw in keywords:
                    variations.add(kw.upper())
                    variations.add(kw.lower())
                    # Adicionar com espaços (ex: "a 9000")
                    if len(kw) >= 4:
                        spaced = ' '.join(kw[i:i+1] for i in range(len(kw)))
                        variations.add(spaced)

                variations_str = ', '.join(sorted(variations)[:8])  # Limitar para não ficar muito longo
                mapping_line = f"- **{variations_str}** → {spec['name']}"
                mapping_lines.append(mapping_line)

        result = '\n'.join(mapping_lines) if mapping_lines else "Nenhum mapeamento específico disponível"
        logger.info(f"📋 [MAPEAMENTO FINAL] {len(mapping_lines)} linhas geradas")
        return result

    def _find_specialist_by_keyword(self, specialists: List[Dict], keyword: str) -> str:
        """Encontra nome do especialista que atende determinada keyword"""
        keyword_lower = keyword.lower().replace(' ', '')

        for spec in specialists:
            keywords = self._extract_keywords(spec)  # Sem log detalhado
            for kw in keywords:
                kw_normalized = kw.lower().replace(' ', '')
                match_exact = kw_normalized == keyword_lower
                match_contains = keyword_lower in kw_normalized

                if match_exact or match_contains:
                    return spec['name']

        return "Especialista não encontrado"

    def _build_team_context(self, team, leader, members: List[Dict], task: str, history: List[Dict]) -> str:
        """
        Constrói contexto DINÂMICO para complementar instruções do líder.
        NÃO duplica informações que já estão nas instruções do banco.
        Apenas adiciona: histórico da conversa e mapeamento técnico de especialistas.
        """

        # Formatar histórico
        history_text = ""
        if history:
            history_text = "## 💬 HISTÓRICO DA CONVERSA\n"
            for msg in history[-5:]:  # Últimas 5 mensagens
                msg_type = msg.get('type', 'unknown')
                content = msg.get('content', '')
                if msg_type == 'user':
                    history_text += f"**Usuário:** {content}\n"
                elif msg_type in ['team', 'agent']:
                    history_text += f"**Assistente:** {content}\n"

        # Criar mapeamento de variações de nomes para especialistas
        specialist_mapping = self._build_specialist_mapping(members)

        # Contexto simplificado - apenas informações dinâmicas que complementam as instruções do banco
        context_parts = []

        # ⚠️ REGRA CRÍTICA - DELEGAÇÃO OBRIGATÓRIA
        context_parts.append("""
## ⚠️ PROTOCOLO DE DELEGAÇÃO OBRIGATÓRIA

**VOCÊ É UM COORDENADOR - SUA ÚNICA FUNÇÃO É ROTEAR**

🔥 **FUNÇÃO DE DELEGAÇÃO CORRETA:**
✅ A ÚNICA função válida é: `delegate_task_to_member(member_id, task_description, expected_output)`
✅ Use `member_id` com o ID do agente (formato: "agent-123")
❌ NÃO use `agent_name`, `member`, ou `transfer_task_to_member` - são INCORRETOS

⚠️ **VOCÊ NÃO TEM ACESSO A BASES DE CONHECIMENTO (RAG)**
⚠️ **VOCÊ NÃO DEVE USAR A FUNÇÃO `search()` - APENAS OS ESPECIALISTAS TÊM ESSA FERRAMENTA**

### 🚨 REGRA CRÍTICA DE IDENTIFICAÇÃO DE MODELO

**ATENÇÃO MÁXIMA AO MODELO MENCIONADO PELO USUÁRIO:**

**Case IH (Série A):**
- A8000, A8800, A8810, 8000, 8800, 8810 → SEMPRE delegar para: **"Especialista Case IH A8000/A8800/A8810"**
- A9000, A9900, 9000, 9900 → SEMPRE delegar para: **"Especialista Case IH A9000"**

**John Deere (Série CH):**
- CH570, CH670, 570, 670 → SEMPRE delegar para: **"Especialista John Deere CH570/CH670"**
- CH950, 950 → SEMPRE delegar para: **"Especialista John Deere CH950"**

**❌ ERROS FATAIS A EVITAR:**
- ❌ NUNCA delegue A8810 para "Especialista John Deere CH950"
- ❌ NUNCA delegue CH950 para "Especialista Case IH A8000/A8800/A8810"
- ❌ NUNCA confunda Case IH (letra A) com John Deere (letra CH)
- ❌ São MARCAS DIFERENTES e MODELOS DIFERENTES!

### 🚫 REGRA ANTI-LOOP - LEIA COM ATENÇÃO!

**ANTES de fazer QUALQUER ação, VERIFIQUE O HISTÓRICO:**

1. ✅ **Você já delegou esta tarefa antes?**
   - Procure no histórico por "delegate_task_to_member"
   - Se SIM → **PARE IMEDIATAMENTE**. Não delegue novamente, não responda, não faça NADA.

2. ✅ **A última mensagem foi de um especialista?**
   - Se SIM → **PARE IMEDIATAMENTE**. Não interfira. O especialista já está respondendo.

3. ✅ **Esta é uma NOVA pergunta do usuário?**
   - Se NÃO → **PARE IMEDIATAMENTE**. Não repita delegação.

**⚠️ REGRA DE OURO: Você delega APENAS UMA VEZ por nova solicitação do usuário.**

### 🚫 NUNCA RETORNE CÓDIGO OU FERRAMENTAS COMO TEXTO!

**PROIBIDO ABSOLUTAMENTE:**
❌ NUNCA escreva "delegate_task_to_member(...)" como texto de resposta
❌ NUNCA mostre código Python, JSON ou qualquer sintaxe ao usuário
❌ NUNCA explique que você está "delegando" ou "usando ferramentas"

**SEMPRE:**
✅ EXECUTE a ferramenta `delegate_task_to_member()` SILENCIOSAMENTE
✅ Após executar, PARE - não envie mensagem adicional
✅ Se precisa perguntar algo, responda em linguagem natural (português)

### 📋 Quando e Como Delegar:

Quando o usuário mencionar um modelo específico (ex: A8810, CH950, A9000, CH570):
1. ✅ Verifique o histórico (evite delegação duplicada)
2. ✅ SEMPRE use `delegate_task_to_member(member_id="agent-123", task_description="tarefa", expected_output="resposta técnica")` IMEDIATAMENTE
3. ❌ NUNCA tente responder você mesmo sobre questões técnicas
4. ❌ NUNCA use `search()` - você não tem acesso a essa função
5. ✅ Delegue a tarefa COMPLETA com TODO o contexto necessário
6. ✅ **APÓS DELEGAR → PARE. Não envie mensagens adicionais.**

**Você só pode responder diretamente quando:**
- Usuário ainda não informou o modelo E não há delegação prévia
- Você precisa fazer perguntas de esclarecimento para identificar o modelo correto

**⭐ Formato OBRIGATÓRIO de delegação:**
```python
delegate_task_to_member(
    member_id="agent-123",  # ID do especialista (veja tabela abaixo)
    task_description="Usuário relata: pistões hidráulicos dando coices na A8810. Por favor, diagnostique e forneça solução completa.",
    expected_output="Diagnóstico técnico completo com possíveis causas e soluções detalhadas para o problema nos pistões hidráulicos."
)
```

**REGRAS CRÍTICAS:**
- ✅ Use `member_id="agent-123"` (STRING com ID do agente - veja tabela de mapeamento abaixo)
- ✅ Use `task_description="descrição completa da tarefa"`
- ✅ Use `expected_output="descrição do resultado esperado"`
- ❌ NÃO use `agent_name`, `member`, `transfer_task_to_member` - são INCORRETOS
- ✅ A ÚNICA função válida é `delegate_task_to_member`
- ✅ Após chamar a função, PARE - não envie mensagem ao usuário
""")

        # Adicionar histórico se existir
        if history_text:
            context_parts.append(f"---\n{history_text}")

        # Adicionar mapeamento técnico de especialistas disponíveis
        # DEBUG: Log dos mapeamentos gerados para verificar se estão corretos
        a9000_specialist = self._find_specialist_by_keyword(members, '9000')
        ch570_specialist = self._find_specialist_by_keyword(members, '570')
        a8810_specialist = self._find_specialist_by_keyword(members, '8810')
        ch950_specialist = self._find_specialist_by_keyword(members, '950')

        logger.info(f"📋 [MAPEAMENTOS GERADOS]")
        logger.info(f"   - A9000/9000 → {a9000_specialist}")
        logger.info(f"   - CH570/570 → {ch570_specialist}")
        logger.info(f"   - A8810/8810 → {a8810_specialist}")
        logger.info(f"   - CH950/950 → {ch950_specialist}")

        context_parts.append(f"""---

## 🔧 TABELA DE DELEGAÇÃO - SIGA EXATAMENTE

| USUÁRIO MENCIONA | DELEGUE PARA (copie EXATO) | MARCA |
|------------------|----------------------------|-------|
| A8000, A8800, A8810, 8000, 8800, 8810 | {a8810_specialist} | Case IH |
| A9000, A9900, 9000, 9900 | {a9000_specialist} | Case IH |
| CH570, CH670, 570, 670 | {ch570_specialist} | John Deere |
| CH950, 950 | {ch950_specialist} | John Deere |

### ⭐ INSTRUÇÕES DE USO DA TABELA:

**Passo 1:** Identifique o modelo que o usuário mencionou
**Passo 2:** Procure na PRIMEIRA coluna da tabela
**Passo 3:** Copie EXATAMENTE o nome da SEGUNDA coluna
**Passo 4:** Use assim:

```python
transfer_task_to_member(
    agent_name="<Nome EXATO copiado da tabela>",
    task_description="<Descrição completa da tarefa do usuário>",
    expected_output="Resposta técnica detalhada com diagnóstico e soluções"
)
```

### 📋 Especialistas Disponíveis:

{self._format_specialists(members)}

### Mapeamento Técnico:
{specialist_mapping}

**⚠️ VERIFICAÇÕES OBRIGATÓRIAS:**
1. ✅ Verifique o histórico - modelo pode ter sido mencionado antes
2. ✅ Use `agent_name="Nome Completo"` (STRING com nome exato)
3. ✅ Copie o nome EXATAMENTE como está na tabela
4. ✅ A ÚNICA função válida é `transfer_task_to_member`
5. ✅ NUNCA use `delegate_task_to_member`, `delegate`, `member` ou `member_id`
6. ✅ Inclua sempre os 3 parâmetros: `agent_name`, `task_description`, `expected_output`
7. ✅ Caso usuário mencione "A8810" → use "{a8810_specialist}" (NÃO use "{ch950_specialist}"!)
""")

        context = "\n".join(context_parts)

        # DEBUG: Salvar contexto para análise
        logger.info(f"📄 [CONTEXTO GERADO PARA COORDENADOR]")
        logger.info(f"   - Tamanho total: {len(context)} caracteres")
        logger.info(f"   - Exemplos de delegação incluem:")
        logger.info(f"     • A9000/9000 → {a9000_specialist}")
        logger.info(f"     • CH570/570 → {ch570_specialist}")
        logger.info(f"     • A8810/8810 → {a8810_specialist}")
        logger.info(f"     • CH950/950 → {ch950_specialist}")

        return context

    def _build_agent_instructions(self, agent_config: Dict, agent_collections: List[Dict]) -> str:
        """Constrói instruções com orientação inteligente de RAG"""

        base_instructions = agent_config.get('instructions', '')

        if not agent_collections:
            return base_instructions

        rag_instructions = f"""

---

## 🔍 BASES DE CONHECIMENTO DISPONÍVEIS

Você tem acesso a {len(agent_collections)} base(s) de conhecimento:
{self._format_collections(agent_collections)}

### 📚 Como Usar a Ferramenta de Busca

**Função disponível:** `search(query: str, collection_name: str = None, limit: int = 5)`

**Quando BUSCAR nas bases:**
1. ✅ Perguntas sobre **especificações técnicas** (capacidades, dimensões, modelos)
2. ✅ Solicitações de **procedimentos específicos** (como fazer manutenção, calibração)
3. ✅ Dúvidas sobre **códigos de erro** ou diagnósticos
4. ✅ Informações que exigem **precisão numérica** (pressões, temperaturas, torques)
5. ✅ Referências a **manuais ou documentação** específica
6. ✅ Respostas de sim e não ao que você perguntou.

**Quando NÃO buscar:**
1. ❌ Perguntas que você **já sabe responder** com conhecimento geral
2. ❌ Conversação **casual ou esclarecimentos** simples
4. ❌ Saudações, agradecimentos, ou interações **não técnicas**

### 🎯 COMO FORMULAR QUERIES EFICAZES

**Técnicas para criar buscas de alta qualidade:**

1. **Seja ESPECÍFICO sobre o componente:**
   - Inclua o nome técnico completo do componente/sistema
   - Use termos da documentação técnica

2. **Adicione CONTEXTO do problema:**
   - Descreva o tipo de informação buscada (especificações, diagnóstico, procedimento)
   - Inclua sintomas ou comportamentos relevantes

3. **Use TERMOS TÉCNICOS corretos:**
   - Prefira linguagem técnica da documentação
   - Evite gírias ou termos coloquiais

4. **Mantenha comprimento ADEQUADO:**
   - Ideal: 5-15 palavras
   - Evite queries muito curtas (< 3 palavras) ou muito longas (> 20 palavras)

### 💡 Exemplos de Queries - BOM vs RUIM

**❌ RUIM - Muito vaga:**
```python
search("pistão")  # Falta contexto e especificidade
```

**✅ BOM - Específica e contextualizada:**
```python
search("especificações técnicas pistão hidráulico diâmetro pressão operacional")
```

**❌ RUIM - Termos coloquiais:**
```python
search("máquina dando problema")  # Linguagem imprecisa
```

**✅ BOM - Termos técnicos:**
```python
search("diagnóstico falha sistema hidráulico oscilação operação")
```

**❌ RUIM - Pergunta completa:**
```python
search("Como eu faço para calibrar a pressão do sistema hidráulico?")  # Muito longa
```

**✅ BOM - Keywords relevantes:**
```python
search("procedimento calibração pressão sistema hidráulico")
```

### 🔄 REFINAMENTO DE BUSCA

**Se a primeira busca não retornar resultados relevantes (score < 0.7):**

1. **Reformule com SINÔNIMOS técnicos:**
   - pistão → cilindro → êmbolo hidráulico
   - oscilação → vibração → instabilidade
   - falha → defeito → mau funcionamento

2. **Use técnica de GENERALIZAÇÃO (do específico para o geral):**
   - Nível 1: "pistão frontal esquerdo modelo XYZ"
   - Nível 2: "sistema pistões hidráulicos modelo XYZ"
   - Nível 3: "sistema hidráulico colheitadeira"

3. **Ou técnica de ESPECIALIZAÇÃO (do geral para o específico):**
   - Nível 1: "sistema hidráulico"
   - Nível 2: "sistema pistões hidráulicos"
   - Nível 3: "pistão frontal calibração pressão"

4. **Tente MÚLTIPLAS QUERIES complementares:**
   - Query 1: Componente específico → "especificações pistão hidráulico"
   - Query 2: Sistema geral → "diagnóstico sistema hidráulico"
   - Query 3: Procedimento → "procedimento manutenção pistões"

### 📋 GLOSSÁRIO DE TERMOS

**Traduza termos coloquiais para técnicos:**
- "dando coice" → oscilação hidráulica, cavitação
- "não funciona" → falha operacional, indisponibilidade
- "fazendo barulho" → ruído anormal, vibração excessiva
- "perdendo força" → perda de pressão, vazamento hidráulico
- "travando" → travamento mecânico, bloqueio sistema

---

**IMPORTANTE:**
- Busque nas bases **apenas quando realmente necessário**
- Sempre **cite a fonte** quando usar informações das bases (ex: "Segundo o manual técnico...")
- Se não encontrar nas bases, responda com seu conhecimento geral
- Se score dos resultados < 0.6, indique que a informação pode não ser precisa
- Use múltiplas queries complementares para problemas complexos
"""

        return base_instructions + rag_instructions

    def _create_team_agent(self, team_id: int, leader_config: Dict, team_members: List[Dict], team_context: str, session_id: str = None) -> Team:
        """Cria agente de time com contexto enriquecido usando modo de roteamento"""

        # Criar instâncias dos membros com instruções RAG inteligentes
        member_agents = []

        for member in team_members:
            # Buscar coleções do membro
            member_collections = self.get_agent_collections(member['id'])

            # Construir instruções com orientação RAG
            enhanced_instructions = self._build_agent_instructions(member, member_collections)

            # Atualizar configuração com instruções aprimoradas
            member_copy = member.copy()
            member_copy['instructions'] = enhanced_instructions

            # Criar agente
            agent_instance = self._get_or_create_agent(member['id'], member_copy)
            member_agents.append(agent_instance)

            logger.info(f"👤 MEMBRO CRIADO: {member['name']} com {len(member_collections)} coleções RAG")

        # ✅ CACHE POR SESSION: Cada sessão precisa de seu próprio Team para manter memória
        cache_key = session_id if session_id else f"team-{team_id}-default"

        if cache_key in self.active_teams:
            team_agent = self.active_teams[cache_key]
            logger.info(f"♻️ REUTILIZANDO TEAM: {leader_config['name']} (session: {cache_key})")
        else:
            # Criar líder com contexto do time usando a classe Team em modo de roteamento
            # IMPORTANTE: Manter instruções originais do líder (do banco) e adicionar contexto dinâmico
            # O team_context adiciona informações de histórico e mapeamento de especialistas
            leader_instructions = f"{leader_config.get('instructions', '')}\n\n{team_context}"

            team_agent = Team(
                name=leader_config['name'],
                role=leader_config['role'],
                members=member_agents,
                model=OpenAIChat(
                    id=leader_config.get('model', 'gpt-4o-mini'),
                    temperature=leader_config.get('temperature', 0.7)
                ),
                instructions=leader_instructions,
                markdown=True,
                respond_directly=True,
                stream=True,
                # ✅ Configurações CRÍTICAS para manter contexto entre requests
                db=self.agno_db,                         # Storage persistente
                memory_manager=self.memory_manager,      # Gerenciador de memória
                read_team_history=True,                  # Lê histórico da sessão
                share_member_interactions=True,          # Membros veem mensagens uns dos outros
                enable_session_summaries=True,           # Cria resumos automáticos
                enable_agentic_memory=True,              # Gestão ativa de memórias
                enable_user_memories=True                # Grava memórias de usuário
            )

            # Armazenar no cache POR SESSION
            self.active_teams[cache_key] = team_agent
            logger.info(f"👑 TEAM CRIADO: {leader_config['name']} coordenando {len(member_agents)} especialistas")
            logger.info(f"🔑 CACHE KEY: {cache_key}")
        logger.info(f"📊 MEMBERS REGISTRADOS: {[m.name for m in member_agents]}")
        logger.info(f"🎯 SHOW_TOOL_CALLS: True (debug ativado)")

        return team_agent

    def _extract_agents_from_response(self, response, leader_config: Dict, team_members: List[Dict], delegated_agent_name: str = None) -> List[str]:
        """Extrai nomes dos agentes que participaram da resposta

        Args:
            response: Resposta do agente (pode ser RunResponse ou RunContentEvent)
            leader_config: Configuração do líder
            team_members: Lista de membros do time
            delegated_agent_name: Nome do agente delegado (string) extraído do tool_call transfer_task_to_member
        """

        agents = []
        agents_from_messages = []

        logger.info(f"🔍 INICIANDO EXTRAÇÃO DE AGENTES - Response type: {type(response).__name__}")
        logger.info(f"🔍 Response tem 'messages': {hasattr(response, 'messages')}")
        logger.info(f"🔍 Delegated agent_name recebido: {delegated_agent_name}")

        # Verificar se houve delegação através das mensagens
        if hasattr(response, 'messages') and response.messages:
            logger.info(f"🔍 ANALISANDO {len(response.messages)} MENSAGENS PARA DETECTAR AGENTES...")

            for idx, msg in enumerate(response.messages):
                msg_role = getattr(msg, 'role', 'unknown')
                msg_name = getattr(msg, 'name', None)
                msg_content_preview = str(getattr(msg, 'content', ''))[:100] if hasattr(msg, 'content') else ''

                logger.info(f"  MSG[{idx}]: role={msg_role}, name={msg_name}, content_preview={msg_content_preview[:50]}...")

                # Se a mensagem tem um nome, é um agente específico
                if msg_name:
                    if msg_name not in agents_from_messages:
                        agents_from_messages.append(msg_name)
                        logger.info(f"    ✅ AGENTE DETECTADO NAS MENSAGENS: {msg_name}")
        else:
            logger.info(f"⚠️ Response NÃO TEM messages ou messages está vazio")

        # PRIORIDADE 1: Se temos delegated_agent_name do tool_call, usar ele (mais confiável)
        if delegated_agent_name:
            agents.append(delegated_agent_name)
            logger.info(f"✅ AGENTE DELEGADO (via tool_call agent_name): {delegated_agent_name}")
        # PRIORIDADE 2: Se detectou agentes através das mensagens
        elif agents_from_messages:
            agents.extend(agents_from_messages)
            logger.info(f"✅ AGENTES DETECTADOS NAS MENSAGENS: {agents_from_messages}")
        # PRIORIDADE 3: Se não encontrou nenhum agente, adicionar o líder
        else:
            agents.append(leader_config['name'])
            logger.info(f"  ℹ️ NENHUM AGENTE ESPECÍFICO DETECTADO - USANDO LÍDER")

        logger.info(f"📊 AGENTES FINAIS DETECTADOS: {agents}")

        return agents

    def execute_team_task_with_context(self, team_id: int, task: str, context_history: List[Dict] = None, session_id: str = None) -> Dict:
        """
        Execução simplificada - deixa o Agno coordenar automaticamente

        Args:
            team_id: ID do time
            task: Tarefa
            context_history: Histórico (para construir contexto textual)
            session_id: ID da sessão - CRÍTICO para manter memória do Team
        """
        start_time = time.time()
        context_history = context_history or []

        try:
            logger.info(f"🚀 [TIME-{team_id}] INICIANDO EXECUÇÃO DA TAREFA")
            logger.info(f"📋 [TIME-{team_id}] TAREFA: {task[:200]}...")
            logger.info(f"📚 [TIME-{team_id}] CONTEXTO: {len(context_history)} mensagens anteriores")

            # Buscar team e membros
            team = self.db.query(AgentTeam).filter(AgentTeam.id == team_id).first()
            if not team:
                raise ValueError(f"Time {team_id} não encontrado")

            # Buscar membros do time (EXCLUINDO o líder - ele será tratado separadamente)
            team_members_query = self.db.query(
                TeamMember.agent_id,
                AgentModel.name,
                AgentModel.description,
                AgentModel.role,
                AgentModel.model,
                AgentModel.temperature,
                AgentModel.instructions,
                AgentModel.tools_config
            ).join(AgentModel, TeamMember.agent_id == AgentModel.id).filter(
                TeamMember.team_id == team_id,
                AgentModel.is_active == True,
                TeamMember.agent_id != team.leader_agent_id  # ✅ EXCLUIR O LÍDER
            )

            team_members = []
            for result in team_members_query:
                member_data = {
                    'id': result.agent_id,
                    'name': result.name,
                    'description': result.description,
                    'role': result.role,
                    'model': result.model,
                    'temperature': result.temperature,
                    'instructions': result.instructions,
                    'tools_config': result.tools_config or []
                }
                team_members.append(member_data)

            if not team_members:
                raise ValueError(f"Nenhum membro ativo encontrado para o time {team_id}")

            # Buscar líder
            leader_config = None
            if team.leader_agent_id:
                leader = self.db.query(AgentModel).filter(
                    AgentModel.id == team.leader_agent_id,
                    AgentModel.is_active == True
                ).first()

                if leader:
                    leader_config = {
                        'id': leader.id,
                        'name': leader.name,
                        'description': leader.description,
                        'role': leader.role,
                        'model': leader.model,
                        'temperature': leader.temperature,
                        'instructions': leader.instructions,
                        'tools_config': leader.tools_config or []
                    }

            if not leader_config:
                raise ValueError(f"Líder do time {team_id} não encontrado ou inativo")

            # Log para verificar estrutura
            logger.info(f"🔍 [TIME-{team_id}] LEADER: {leader_config['name']} (ID: {leader_config['id']})")
            logger.info(f"🔍 [TIME-{team_id}] MEMBERS: {[m['name'] for m in team_members]} (Total: {len(team_members)})")
            logger.info(f"🔍 [TIME-{team_id}] LEADER ESTÁ EM MEMBERS? {leader_config['name'] in [m['name'] for m in team_members]}")

            # Construir contexto enriquecido
            team_context = self._build_team_context(
                team=team,
                leader=leader_config,
                members=team_members,
                task=task,
                history=context_history
            )

            logger.info(f"📏 [TIME-{team_id}] CONTEXTO GERADO: {len(team_context)} caracteres")
            logger.info(f"👥 [TIME-{team_id}] MEMBROS: {[m['name'] for m in team_members]}")

            # ✅ CALCULAR TOKENS DE CONTEXTO EXTRA (antes da execução)
            context_tokens = 0
            instructions_tokens = 0
            try:
                import tiktoken
                encoding = tiktoken.encoding_for_model("gpt-4")

                # Tokens do contexto do team (mapeamentos, instruções do coordenador)
                context_tokens = len(encoding.encode(team_context))
                logger.info(f"📝 [TIME-{team_id}] Tokens do team_context: {context_tokens}")

                # Tokens das instruções RAG de cada membro
                for member in team_members:
                    member_collections = self.get_agent_collections(member['id'])
                    if member_collections:
                        enhanced_instructions = self._build_agent_instructions(member, member_collections)
                        instructions_tokens += len(encoding.encode(enhanced_instructions))

                logger.info(f"📚 [TIME-{team_id}] Tokens das instruções RAG dos membros: {instructions_tokens}")
            except Exception as e:
                logger.warning(f"⚠️ [TIME-{team_id}] Erro ao calcular tokens extras: {e}")
                context_tokens = 0
                instructions_tokens = 0

            # ✅ EXECUÇÃO DIRETA - AGNO DECIDE TUDO
            # Passar session_id para cache correto
            team_agent = self._create_team_agent(
                team_id=team_id,
                leader_config=leader_config,
                team_members=team_members,
                team_context=team_context,
                session_id=session_id
            )

            logger.info(f"🎯 [TIME-{team_id}] EXECUTANDO TIME COM AGNO...")
            logger.info(f"💾 [TIME-{team_id}] SESSION_ID: {session_id}")

            # ✅ Executar com session_id, user_id e flags de histórico
            if session_id:
                response = team_agent.run(
                    task,
                    session_id=session_id,
                    user_id=None,  # Pode adicionar user_id se necessário
                    add_history_to_context=True,  # Inclui histórico no prompt
                    num_history_runs=6  # Últimas 6 interações
                )
            else:
                logger.warning(f"⚠️ [TIME-{team_id}] SESSION_ID NÃO FORNECIDO - contexto não será mantido!")
                response = team_agent.run(task)

            logger.info(f"🔍 [TIME-{team_id}] RESPONSE TYPE: {type(response)}")
            logger.info(f"🔍 [TIME-{team_id}] RESPONSE: {str(response)[:200]}...")

            # Processar resposta do Team
            response_content = ""
            final_response = response  # Para extrair agentes depois

            # Team retorna um objeto RunResponse com content
            if hasattr(response, 'content'):
                response_content = response.content if response.content else ""
            # Se for generator/iterable
            elif hasattr(response, '__iter__'):
                # Coletar todos os eventos primeiro
                all_events = list(response)

                logger.info(f"🔍 [TIME-{team_id}] TOTAL DE EVENTOS COLETADOS: {len(all_events)}")

                # Detectar se houve delegação (2 requests HTTP)
                # Se houver RunResponse no meio, significa que houve delegação
                run_response_indices = []

                # Log resumido - contagem de eventos e detecção de delegação
                event_types_count = {}
                delegation_detected = False
                delegation_started_idx = None  # ✅ Novo: rastrear onde começou a delegação
                delegation_completed_idx = None
                delegated_to_agent = None
                toolcall_completed_indices = []
                rag_used = False  # Flag para indicar se RAG foi usado
                rag_sources = []  # ✅ Armazenar sources do RAG

                for idx, event in enumerate(all_events):
                    event_type = type(event).__name__
                    event_types_count[event_type] = event_types_count.get(event_type, 0) + 1

                    # Detectar RunResponse
                    if 'RunResponse' in event_type:
                        run_response_indices.append(idx)

                    # Detectar delegação via ToolCallStartedEvent
                    if 'ToolCallStartedEvent' in event_type:
                        # Extrair tool_name do objeto ToolExecution
                        tool_name = None
                        if hasattr(event, 'tool') and event.tool:
                            # event.tool é um ToolExecution object
                            tool_name = getattr(event.tool, 'tool_name', None)

                        logger.info(f"🔧 [TIME-{team_id}] ToolCallStarted no índice {idx} - tool: '{tool_name}'")

                        # Detectar RAG search
                        if tool_name and 'search' in tool_name.lower():
                            rag_used = True
                            logger.info(f"🔍 [TIME-{team_id}] RAG detectado no evento {idx}")

                        # Detectar INÍCIO da delegação
                        if tool_name and ('transfer' in tool_name.lower() or 'delegate' in tool_name.lower()):
                            delegation_started_idx = idx
                            logger.info(f"🎯 [TIME-{team_id}] DELEGAÇÃO INICIADA no índice {idx}")

                    # ✅ CAPTURAR RAG SOURCES do ToolCallCompletedEvent
                    if 'ToolCallCompletedEvent' in event_type:
                        # Verificar se é uma tool de search (RAG)
                        tool_name = None
                        if hasattr(event, 'tool') and event.tool:
                            tool_name = getattr(event.tool, 'tool_name', None)

                        if tool_name and 'search' in tool_name.lower():
                            # Tentar extrair result do RAG
                            if hasattr(event, 'result') and event.result:
                                # event.result pode ser uma lista de dicts com chunks
                                if isinstance(event.result, list):
                                    for item in event.result[:5]:  # Limitar a 5 sources
                                        if isinstance(item, dict):
                                            source = {
                                                'collection': item.get('collection', 'unknown'),
                                                'text': item.get('text', '')[:200],  # Primeiros 200 chars
                                                'score': item.get('score', 0.0),
                                                'metadata': item.get('metadata', {})
                                            }
                                            rag_sources.append(source)
                                    logger.info(f"✅ [TIME-{team_id}] Capturados {len(rag_sources)} RAG sources")
                                elif isinstance(event.result, str):
                                    # Se result é string, apenas marcar que RAG foi usado
                                    logger.info(f"ℹ️ [TIME-{team_id}] RAG result é string (não estruturado)")

                    # Coletar todos os índices de ToolCallCompletedEvent
                    if 'ToolCallCompletedEvent' in event_type:
                        toolcall_completed_indices.append(idx)

                        # Verificar se este completed é de uma delegação
                        tool_name_completed = None
                        if hasattr(event, 'tool') and event.tool:
                            tool_name_completed = getattr(event.tool, 'tool_name', None)

                        # Detectar delegação (transfer_task_to_member ou delegate_task_to_member)
                        if tool_name_completed and ('transfer' in tool_name_completed.lower() or 'delegate' in tool_name_completed.lower()):
                            delegation_detected = True
                            delegation_completed_idx = idx  # Marcar FIM da delegação

                            # Extrair argumentos da delegação
                            tool_args = {}
                            if hasattr(event, 'tool') and hasattr(event.tool, 'tool_args'):
                                tool_args = event.tool.tool_args
                                # Tentar extrair agent_name
                                if isinstance(tool_args, dict):
                                    delegated_to_agent = tool_args.get('agent_name') or tool_args.get('member') or tool_args.get('member_id')
                                else:
                                    delegated_to_agent = None

                            # LOG COMPLETO DA TOOL CALL
                            logger.info(f"🎯 [TIME-{team_id}] DELEGAÇÃO DETECTADA no índice {idx}")
                            logger.info(f"🔍 [TOOL CALL COMPLETO]")
                            logger.info(f"   - tool_name: {tool_name_completed}")
                            logger.info(f"   - tool_args type: {type(tool_args)}")
                            if isinstance(tool_args, dict):
                                import json
                                logger.info(f"   - tool_args JSON: {json.dumps(tool_args, indent=4, default=str)}")
                            else:
                                logger.info(f"   - tool_args raw: {tool_args}")
                            logger.info(f"   - agent_name extraído: {delegated_to_agent}")

                            # Verificar campos
                            if isinstance(tool_args, dict):
                                logger.info(f"   - Todos os campos: {list(tool_args.keys())}")
                                if 'task_description' in tool_args:
                                    task_desc = tool_args.get('task_description', '')
                                    logger.info(f"   - task_description: {task_desc[:100]}...")
                                if 'expected_output' in tool_args:
                                    expected = tool_args.get('expected_output', '')
                                    logger.info(f"   - expected_output: {expected[:100]}...")

                # Log da delegação se detectada
                if delegation_detected:
                    logger.info(f"✅ [TIME-{team_id}] Delegação: início={delegation_started_idx}, fim={delegation_completed_idx}")

                # Log resumido
                logger.info(f"📊 [TIME-{team_id}] Eventos: {event_types_count}")
                if delegation_detected:
                    logger.info(f"🎯 [TIME-{team_id}] Delegado para: {delegated_to_agent}")

                # Se houve delegação, pegar APENAS o último RunResponse (resposta consolidada)
                # Isso evita processar 500+ eventos intermediários
                response_content = ""
                final_response = None

                if run_response_indices:
                    final_response = all_events[run_response_indices[-1]]
                    logger.info(f"📦 [TIME-{team_id}] Usando RunResponse final (índice {run_response_indices[-1]})")

                    # Extrair conteúdo do RunResponse final
                    if hasattr(final_response, 'content') and final_response.content:
                        response_content = str(final_response.content)
                    elif hasattr(final_response, 'messages') and final_response.messages:
                        # Se não tem content, tentar messages
                        for msg in final_response.messages:
                            if hasattr(msg, 'content') and msg.content and hasattr(msg, 'role') and msg.role == 'assistant':
                                response_content += str(msg.content)
                else:
                    # Fallback: quando não há RunResponse, pegar eventos da resposta do especialista
                    logger.info(f"⚠️ [TIME-{team_id}] Sem RunResponse - usando eventos da delegação")

                    # ✅ NOVA LÓGICA: Quando há delegação, a resposta está nos RunContentEvent
                    # que vêm ENTRE ToolCallStarted e ToolCallCompleted
                    if delegation_detected and delegation_started_idx is not None and delegation_completed_idx is not None:
                        logger.info(f"🔍 [TIME-{team_id}] DELEGAÇÃO detectada - coletando RunContentEvent ENTRE delegação")
                        logger.info(f"🔍 [TIME-{team_id}] Range: índice {delegation_started_idx + 1} até {delegation_completed_idx}")

                        # Pegar RunContentEvent que vêm ENTRE ToolCallStarted e ToolCallCompleted
                        # (são os fragmentos da resposta do especialista)
                        all_fragments = []

                        for idx in range(delegation_started_idx + 1, delegation_completed_idx):
                            chunk = all_events[idx]
                            event_type = type(chunk).__name__

                            # Coletar apenas RunContentEvent
                            if 'RunContentEvent' in event_type and hasattr(chunk, 'content') and chunk.content:
                                content = str(chunk.content)
                                if content:
                                    # Evitar duplicatas consecutivas
                                    if not all_fragments or all_fragments[-1] != content:
                                        all_fragments.append(content)

                        logger.info(f"🔍 [TIME-{team_id}] Total de fragmentos coletados: {len(all_fragments)}")

                        if all_fragments:
                            # Log dos tamanhos para detectar se são incrementais ou acumulados
                            if len(all_fragments) > 6:
                                logger.info(f"🔍 [TIME-{team_id}] Primeiros fragmentos: {[len(f) for f in all_fragments[:3]]}")
                                logger.info(f"🔍 [TIME-{team_id}] Últimos fragmentos: {[len(f) for f in all_fragments[-3:]]}")
                                logger.info(f"🔍 [TIME-{team_id}] Maior fragmento: {max(len(f) for f in all_fragments)} chars")

                            # DETECTAR se fragmentos são incrementais ou acumulados
                            # Se os fragmentos são muito pequenos (< 50 chars em média), são incrementais
                            avg_size = sum(len(f) for f in all_fragments) / len(all_fragments)
                            max_size = max(len(f) for f in all_fragments)

                            logger.info(f"🔍 [TIME-{team_id}] Tamanho médio dos fragmentos: {avg_size:.1f} chars")
                            logger.info(f"🔍 [TIME-{team_id}] Tamanho máximo: {max_size} chars")

                            # Se tamanho médio é pequeno (< 20 chars), são incrementais
                            if avg_size < 20:
                                # INCREMENTAIS: concatenar todos
                                response_content = ''.join(all_fragments)
                                logger.info(f"✅ [TIME-{team_id}] Fragmentos INCREMENTAIS detectados - CONCATENANDO todos")
                                logger.info(f"   Total: {len(response_content)} chars de {len(all_fragments)} fragmentos")
                            else:
                                # ACUMULADOS: usar o maior
                                largest_fragment = max(all_fragments, key=len)
                                response_content = largest_fragment
                                logger.info(f"✅ [TIME-{team_id}] Fragmentos ACUMULADOS detectados - usando MAIOR")
                                logger.info(f"   Maior: {len(response_content)} chars de {len(all_fragments)} fragmentos")
                        else:
                            response_content = ""
                            logger.warning(f"⚠️ [TIME-{team_id}] Nenhum fragmento RunContentEvent encontrado entre delegação!")
                    else:
                        # SEM delegação (coordenador): pegar fragmentos incrementais
                        logger.info(f"🔍 [TIME-{team_id}] SEM delegação - coletando fragmentos incrementais")

                        all_fragments = []
                        for idx, chunk in enumerate(all_events):
                            if hasattr(chunk, 'content') and chunk.content:
                                content = str(chunk.content)
                                if content:
                                    all_fragments.append(content)

                        logger.info(f"🔍 [TIME-{team_id}] Total de fragmentos coletados: {len(all_fragments)}")

                        if all_fragments:
                            # Coordenador: conteúdo incremental (cada evento adiciona um pedaço)
                            response_content = ''.join(all_fragments)
                            logger.info(f"✅ [TIME-{team_id}] Concatenados {len(all_fragments)} fragmentos = {len(response_content)} chars")
                        else:
                            response_content = ""
                            logger.warning(f"⚠️ [TIME-{team_id}] Nenhum fragmento encontrado!")

                    logger.info(f"✅ [TIME-{team_id}] Resposta extraída: {len(response_content)} chars")

                response_content = response_content.strip()
                logger.info(f"📏 [TIME-{team_id}] Tamanho da resposta: {len(response_content)} caracteres")

                # Garantir que final_response existe para extração de agentes
                if final_response is None and all_events:
                    final_response = all_events[-1]
            # Fallback
            else:
                response_content = str(response) if response else ""

            # Se ainda estiver vazio, tentar pegar das messages
            if not response_content and hasattr(final_response, 'messages') and final_response.messages:
                for msg in final_response.messages:
                    if hasattr(msg, 'content') and msg.content:
                        response_content += str(msg.content)

            execution_time = int((time.time() - start_time) * 1000)

            # Extrair agentes envolvidos - passar delegated_agent_name (string do tool_call) se houver
            agents_involved = self._extract_agents_from_response(
                final_response,
                leader_config,
                team_members,
                delegated_agent_name=delegated_to_agent if delegation_detected else None
            )

            # ✅ DETECTAR NÚMERO DE CHAMADAS LLM
            # Se mais de 1 agente envolvido = houve delegação = 2 chamadas (coordenador + especialista)
            num_llm_calls = len(agents_involved) if len(agents_involved) > 1 else 1
            logger.info(f"🔢 [TIME-{team_id}] Número de chamadas LLM detectadas: {num_llm_calls}")

            # Extrair tokens do response (se disponível)
            tokens_info = {
                'input': 0,
                'output': 0,
                'total': 0
            }

            # ✅ TENTAR EXTRAIR TOKENS DE VÁRIAS FONTES
            tokens_found = False

            # 1. Tentar pegar do RunResponse (se houver)
            if run_response_indices and all_events:
                run_response = all_events[run_response_indices[-1]]
                if hasattr(run_response, 'metrics') and run_response.metrics:
                    metrics = run_response.metrics
                    if hasattr(metrics, 'input_tokens'):
                        tokens_info['input'] = metrics.input_tokens
                        tokens_found = True
                    if hasattr(metrics, 'output_tokens'):
                        tokens_info['output'] = metrics.output_tokens
                        tokens_found = True
                    if hasattr(metrics, 'total_tokens'):
                        tokens_info['total'] = metrics.total_tokens
                        tokens_found = True
                    else:
                        tokens_info['total'] = tokens_info['input'] + tokens_info['output']

            # 2. Fallback: tentar pegar do final_response
            if not tokens_found and hasattr(final_response, 'metrics') and final_response.metrics:
                metrics = final_response.metrics
                if hasattr(metrics, 'input_tokens'):
                    tokens_info['input'] = metrics.input_tokens
                if hasattr(metrics, 'output_tokens'):
                    tokens_info['output'] = metrics.output_tokens
                if hasattr(metrics, 'total_tokens'):
                    tokens_info['total'] = metrics.total_tokens
                else:
                    tokens_info['total'] = tokens_info['input'] + tokens_info['output']
                tokens_found = True

            # 3. Buscar em todos os eventos por RunResponseEvent com metrics
            if not tokens_found and all_events:
                for event in reversed(all_events):  # Buscar do mais recente
                    if hasattr(event, 'metrics') and event.metrics:
                        metrics = event.metrics
                        if hasattr(metrics, 'input_tokens'):
                            tokens_info['input'] = metrics.input_tokens
                        if hasattr(metrics, 'output_tokens'):
                            tokens_info['output'] = metrics.output_tokens
                        if hasattr(metrics, 'total_tokens'):
                            tokens_info['total'] = metrics.total_tokens
                        else:
                            tokens_info['total'] = tokens_info['input'] + tokens_info['output']
                        tokens_found = True
                        logger.info(f"✅ [TIME-{team_id}] Tokens encontrados em evento: {type(event).__name__}")
                        break

            # 4. ✅ FALLBACK: Calcular tokens manualmente se não encontrou metrics
            if not tokens_found or tokens_info['total'] == 0:
                logger.warning(f"⚠️ [TIME-{team_id}] Tokens não encontrados em metrics - calculando manualmente")
                try:
                    import tiktoken
                    # Usar encoding do GPT-4
                    encoding = tiktoken.encoding_for_model("gpt-4")

                    # Calcular tokens de output (resposta gerada)
                    output_tokens = len(encoding.encode(response_content)) if response_content else 0

                    # Estimar tokens de input (contexto + task)
                    input_estimate = 0

                    # context_history pode ser string ou lista
                    if context_history:
                        if isinstance(context_history, str):
                            input_estimate = len(encoding.encode(context_history))
                        elif isinstance(context_history, list):
                            # Se for lista de mensagens, concatenar
                            context_text = "\n".join(str(msg) for msg in context_history)
                            input_estimate = len(encoding.encode(context_text))

                    # Adicionar tokens do task
                    if task:
                        input_estimate += len(encoding.encode(str(task)))

                    tokens_info['input'] = input_estimate
                    tokens_info['output'] = output_tokens
                    tokens_info['total'] = input_estimate + output_tokens

                    logger.info(f"✅ [TIME-{team_id}] Tokens calculados: in={input_estimate}, out={output_tokens}, total={tokens_info['total']}")
                except Exception as e:
                    logger.error(f"❌ [TIME-{team_id}] Erro ao calcular tokens: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                    # Manter zeros se falhar

            # ✅ ADICIONAR TOKENS DO RAG AO TOTAL
            if rag_used and rag_sources:
                try:
                    import tiktoken
                    encoding = tiktoken.encoding_for_model("gpt-4")

                    rag_tokens = 0
                    for source in rag_sources:
                        # Calcular tokens do texto do chunk
                        source_text = source.get('text', '')
                        if source_text:
                            rag_tokens += len(encoding.encode(source_text))

                    # Somar tokens do RAG ao input (são tokens consumidos como contexto)
                    tokens_info['input'] += rag_tokens
                    tokens_info['total'] += rag_tokens

                    logger.info(f"📚 [TIME-{team_id}] Tokens do RAG: {rag_tokens} (de {len(rag_sources)} sources)")
                    logger.info(f"📊 [TIME-{team_id}] Total atualizado: {tokens_info['total']} (input: {tokens_info['input']} + RAG, output: {tokens_info['output']})")
                except Exception as e:
                    logger.warning(f"⚠️ [TIME-{team_id}] Erro ao calcular tokens do RAG: {e}")

            # ✅ ADICIONAR TOKENS DE CONTEXTO EXTRA (calculados antes da execução)
            if context_tokens > 0:
                tokens_info['input'] += context_tokens
                tokens_info['total'] += context_tokens
                logger.info(f"📝 [TIME-{team_id}] Tokens de contexto team adicionados: {context_tokens}")

            if instructions_tokens > 0:
                tokens_info['input'] += instructions_tokens
                tokens_info['total'] += instructions_tokens
                logger.info(f"📚 [TIME-{team_id}] Tokens de instruções RAG adicionados: {instructions_tokens}")

            # ✅ LOG DETALHADO DE BREAKDOWN DE TOKENS
            rag_tokens_calc = sum([len(tiktoken.encoding_for_model("gpt-4").encode(s.get('text', ''))) for s in rag_sources]) if rag_sources else 0
            base_input = tokens_info['input'] - rag_tokens_calc - context_tokens - instructions_tokens

            logger.info(f"✅ [TIME-{team_id}] EXECUÇÃO CONCLUÍDA: {execution_time}ms")
            logger.info(f"👥 [TIME-{team_id}] AGENTES ENVOLVIDOS: {agents_involved}")
            logger.info(f"🔢 [TIME-{team_id}] TOKENS TOTAL: {tokens_info['total']}")
            logger.info(f"📊 [TIME-{team_id}] BREAKDOWN DETALHADO:")
            logger.info(f"   ├─ Input base (task + histórico): {base_input}")
            logger.info(f"   ├─ Contexto team (coordenador): {context_tokens}")
            logger.info(f"   ├─ Instruções RAG (membros): {instructions_tokens}")
            logger.info(f"   ├─ RAG chunks: {rag_tokens_calc}")
            logger.info(f"   ├─ Output (resposta): {tokens_info['output']}")
            logger.info(f"   └─ Chamadas LLM: {num_llm_calls}")

            return {
                'success': True,
                'team_response': response_content,
                'agents_involved': agents_involved,
                'execution_time_ms': execution_time,
                'tool_calls': len(response.messages) if hasattr(response, 'messages') else 0,
                'tokens': tokens_info,
                'tokens_extra': {  # ✅ NOVO: Breakdown detalhado de tokens
                    'base_input': base_input,
                    'context_tokens': context_tokens,
                    'instructions_tokens': instructions_tokens,
                    'rag_tokens': rag_tokens_calc,
                    'output_tokens': tokens_info['output'],
                    'num_llm_calls': num_llm_calls,
                    'estimated_total': tokens_info['total']
                },
                'rag_used': rag_used,
                'rag_sources': rag_sources,  # ✅ Adicionar sources do RAG
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)

            logger.error(f"💥 [TIME-{team_id}] ERRO NA EXECUÇÃO: {str(e)}")
            logger.error(f"⏱️ [TIME-{team_id}] TEMPO ATÉ ERRO: {execution_time}ms")

            return {
                'success': False,
                'error': str(e),
                'execution_time_ms': execution_time,
                'timestamp': datetime.now().isoformat()
            }


    def _execute_specialist_directly(self, team_id: int, specialist: Dict, task: str,
                                   context_text: str, start_time: float, leader_config: Dict) -> Dict:
        """
        Executa um especialista específico diretamente (sem RAG automático)
        O especialista decide se e quando buscar nas bases de conhecimento
        """
        logger.info(f"👨‍🔧 [TIME-{team_id}] EXECUTANDO ESPECIALISTA: {specialist['name']}")

        # Contexto simplificado - sem RAG forçado
        specialist_context = f"""
        {context_text}

        Você é {specialist['name']} - {specialist.get('role', 'Especialista')}.

        Tarefa: {task}

        Forneça uma resposta técnica detalhada baseada na sua especialidade e conhecimento.
        Se necessário, use a ferramenta de busca disponível para consultar as bases de conhecimento.
        """

        specialist_agent = self._get_or_create_agent(specialist['id'], specialist)
        response = specialist_agent.run(specialist_context)

        # Processar resposta - verificar se é generator (streaming)
        if hasattr(response, '__iter__') and not hasattr(response, 'content'):
            full_response = ""
            for chunk in response:
                if hasattr(chunk, 'content'):
                    full_response += chunk.content
                else:
                    full_response += str(chunk)
            response_content = full_response
        else:
            response_content = response.content if hasattr(response, 'content') else str(response)

        execution_time = int((time.time() - start_time) * 1000)

        # Detectar uso de RAG através dos tool calls
        rag_used = False
        tool_calls_count = 0
        if hasattr(response, 'messages'):
            for msg in response.messages:
                if hasattr(msg, 'tool_calls') and msg.tool_calls:
                    tool_calls_count += len(msg.tool_calls)
                    for tc in msg.tool_calls:
                        if hasattr(tc, 'function') and 'search' in str(tc.function.name):
                            rag_used = True

        logger.info(f"✅ [TIME-{team_id}] ESPECIALISTA RESPONDEU: {len(response_content)} caracteres")
        logger.info(f"🔧 [TIME-{team_id}] TOOL CALLS: {tool_calls_count} | RAG USADO: {rag_used}")

        return {
            "task": task,
            "team_response": response_content,
            "agents_involved": [leader_config['name'], specialist['name']],
            "execution_time_ms": execution_time,
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "delegation_type": "specialist_direct",
            "rag_info": {
                "rag_used": rag_used,
                "tool_calls": tool_calls_count
            }
        }

    def _execute_leader_response(self, team_id: int, leader_config: Dict, leader_context: str, task: str, start_time: float) -> Dict:
        """
        Executa resposta direta do líder
        """
        logger.info(f"👑 [TIME-{team_id}] EXECUTANDO LÍDER: {leader_config['name']}")
        
        leader_agent = self._get_or_create_agent(leader_config['id'], leader_config)
        response = leader_agent.run(leader_context)

        # Processar resposta - verificar se é generator (streaming)
        if hasattr(response, '__iter__') and not hasattr(response, 'content'):
            # É um generator - processar para obter resposta completa
            full_response = ""
            for chunk in response:
                if hasattr(chunk, 'content'):
                    full_response += chunk.content
                else:
                    full_response += str(chunk)
            response_content = full_response
        else:
            response_content = response.content if hasattr(response, 'content') else str(response)
        execution_time = int((time.time() - start_time) * 1000)
        
        logger.info(f"✅ [TIME-{team_id}] LÍDER RESPONDEU: {len(response_content)} caracteres")
        
        return {
            "task": task,
            "team_response": response_content,
            "agents_involved": [leader_config['name']],
            "execution_time_ms": execution_time,
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "delegation_type": "leader_direct"
        }

    def _get_or_create_agent(self, agent_id: int, agent_config: Dict):
        """
        Obtém ou cria um agente Agno baseado na configuração
        """
        if agent_id in self.active_agents:
            return self.active_agents[agent_id]
        
        # Buscar coleções permitidas para o agente
        allowed_collections = self.get_agent_collections(agent_id)
        collection_names = [col['name'] for col in allowed_collections]
        
        # Criar ferramenta RAG se há coleções disponíveis
        tools = []
        if collection_names:
            logger.info(f"🗄️ [AGENT-{agent_id}] COLEÇÕES RAG DISPONÍVEIS: {collection_names}")
            rag_tool = QdrantRAGTool(
                qdrant_service=self.qdrant_service,
                allowed_collections=collection_names,
                db=self.db
            )
            tools.append(rag_tool.search)  # Adicionar o método search como ferramenta
            logger.info(f"✅ [AGENT-{agent_id}] FERRAMENTA RAG CRIADA COM {len(collection_names)} COLEÇÕES")
        else:
            logger.info(f"⚠️ [AGENT-{agent_id}] NENHUMA COLEÇÃO RAG ASSOCIADA")
        
        # Adicionar ferramentas extras baseadas na configuração
        tools_config = agent_config.get('tools_config', [])
        if isinstance(tools_config, list):
            for tool_name in tools_config:
                if tool_name == 'duckduckgo':
                    tools.append(DuckDuckGoTools())
                elif tool_name == 'reasoning':
                    tools.append(ReasoningTools())
        
        # Criar agente Agno
        agent = Agent(
            name=agent_config.get('name', f'Agent-{agent_id}'),
            role=agent_config.get('role', 'Assistant'),
            id=f"agent-{agent_id}",  # ID único para delegação
            model=OpenAIChat(
                id=agent_config.get('model', 'gpt-4o-mini'),
                temperature=agent_config.get('temperature', 0.7)
            ),
            instructions=agent_config.get('instructions', ''),
            tools=tools,
            debug_mode=False,
            markdown=True,
            stream=True
        )
        
        # Cache do agente
        self.active_agents[agent_id] = agent
        return agent

    def clear_agent_cache(self, agent_id: Optional[int] = None):
        """
        Limpa cache de agentes ativos
        """
        if agent_id:
            if agent_id in self.active_agents:
                del self.active_agents[agent_id]
        else:
            self.active_agents.clear()

    def get_execution_stats(self) -> Dict:
        """
        Retorna estatísticas de execução
        """
        if not self.execution_history:
            return {
                "total_executions": 0,
                "success_rate": 0,
                "avg_execution_time_ms": 0,
                "tools_usage": {}
            }

        successful = [e for e in self.execution_history if e.get('success')]

        # Calcular uso de ferramentas
        tools_usage = {}
        for execution in successful:
            tools_list = execution.get('tools_used', []) or []
            for tool in tools_list:
                tools_usage[tool] = tools_usage.get(tool, 0) + 1

        avg_time = sum(e.get('execution_time_ms', 0) for e in self.execution_history) / len(self.execution_history)

        return {
            "total_executions": len(self.execution_history),
            "successful_executions": len(successful),
            "success_rate": len(successful) / len(self.execution_history) * 100,
            "avg_execution_time_ms": int(avg_time),
            "tools_usage": tools_usage,
            "last_execution": self.execution_history[-1] if self.execution_history else None
        }


# Funções auxiliares para endpoints FastAPI

async def create_agent(db: Session, agent_data: Dict) -> Dict:
    """
    Cria novo agente no banco de dados
    """
    query = text("""
        INSERT INTO agents (name, description, role, model, temperature, instructions, tools_config)
        VALUES (:name, :description, :role, :model, :temperature, :instructions, :tools_config)
        RETURNING id
    """)

    result = db.execute(query, {
        "name": agent_data.get('name'),
        "description": agent_data.get('description'),
        "role": agent_data.get('role'),
        "model": agent_data.get('model', 'gpt-4o-mini'),
        "temperature": agent_data.get('temperature', 0.7),
        "instructions": agent_data.get('instructions', ''),
        "tools_config": json.dumps(agent_data.get('tools_config', []))
    })

    db.commit()
    agent_id = result.scalar()

    return {"id": agent_id, "message": "Agente criado com sucesso"}


async def assign_collection_to_agent(
        db: Session,
        agent_id: int,
        collection_id: int,
        access_level: str = "read",
        priority: int = 0
) -> Dict:
    """
    Relaciona agente com coleção RAG
    """
    # Verificar se relacionamento já existe
    check_query = text("""
        SELECT 1 FROM agent_collections 
        WHERE agent_id = :agent_id AND collection_id = :collection_id
    """)

    exists = db.execute(check_query, {
        "agent_id": agent_id,
        "collection_id": collection_id
    }).scalar()

    if exists:
        # Atualizar relacionamento existente
        update_query = text("""
            UPDATE agent_collections 
            SET access_level = :access_level, priority = :priority
            WHERE agent_id = :agent_id AND collection_id = :collection_id
        """)

        db.execute(update_query, {
            "agent_id": agent_id,
            "collection_id": collection_id,
            "access_level": access_level,
            "priority": priority
        })
    else:
        # Criar novo relacionamento
        insert_query = text("""
            INSERT INTO agent_collections (agent_id, collection_id, access_level, priority)
            VALUES (:agent_id, :collection_id, :access_level, :priority)
        """)

        db.execute(insert_query, {
            "agent_id": agent_id,
            "collection_id": collection_id,
            "access_level": access_level,
            "priority": priority
        })

    db.commit()

    return {"message": "Coleção associada ao agente com sucesso"}