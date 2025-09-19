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
from agno.models.openai import OpenAIChat
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.reasoning import ReasoningTools

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
        self.execution_history = []

    def get_agent_collections(self, agent_id: int) -> List[Dict]:
        """
        Retorna coleções que o agente pode acessar com seus níveis de permissão
        """
        logger.info(f"🔍 [AGENT-{agent_id}] BUSCANDO COLEÇÕES RAG ASSOCIADAS...")
        
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
            logger.info(f"   📚 [AGENT-{agent_id}] COLEÇÃO: {row.name} (ID: {row.id}) - Acesso: {row.access_level}, Prioridade: {row.priority}")

        if not collections:
            logger.warning(f"⚠️ [AGENT-{agent_id}] NENHUMA COLEÇÃO RAG ENCONTRADA")
        else:
            logger.info(f"✅ [AGENT-{agent_id}] ENCONTRADAS {len(collections)} COLEÇÕES RAG")

        return collections

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
            structured_outputs=True
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
            
            # Criar time com o líder específico
            team = Agent(
                name=leader_agent.name,
                role=leader_agent.role,
                team=member_agents,
                model=leader_agent.model,
                instructions=full_instructions,
                tools=leader_agent.tools if hasattr(leader_agent, 'tools') else [],
                markdown=True,
                show_tool_calls=True
            )
        else:
            # Fallback para líder genérico se não especificado
            leader_model = OpenAIChat(id='gpt-4o-mini')
            
            team = Agent(
                team=member_agents,
                model=leader_model,
                instructions=[
                    "Coordene os agentes do time para resolver a tarefa",
                    "Distribua subtarefas baseado nas especialidades de cada agente",
                    "Sintetize as respostas em uma solução coerente",
                    "Sempre cite qual agente contribuiu com cada parte da resposta"
                ],
                markdown=True,
                show_tool_calls=True
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
            
            # Verificar se houve delegação (múltiplas mensagens)
            if hasattr(response, 'messages') and response.messages:
                logger.info(f"💬 NÚMERO DE MENSAGENS NA CONVERSA: {len(response.messages)}")
                for i, msg in enumerate(response.messages):
                    logger.info(f"  MSG {i+1}: {str(msg)[:200]}...")
            else:
                logger.info(f"⚠️ RESPOSTA SEM MENSAGENS DETALHADAS")

            # Processar resposta
            if hasattr(response, 'content'):
                response_content = response.content
            else:
                response_content = str(response)

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

    def execute_team_task_with_context(self, team_id: int, task: str, context_history: List[Dict] = None) -> Dict:
        """
        Executa uma tarefa em equipe considerando o contexto completo da conversa
        Sistema flexível que suporta diferentes estratégias de delegação
        """
        try:
            start_time = time.time()
            logger.info(f"🚀 [TIME-{team_id}] INICIANDO EXECUÇÃO DA TAREFA")
            logger.info(f"📋 [TIME-{team_id}] TAREFA: {task[:200]}...")
            logger.info(f"📚 [TIME-{team_id}] CONTEXTO: {len(context_history) if context_history else 0} mensagens anteriores")
            
            # Buscar team e membros
            team = self.db.query(AgentTeam).filter(AgentTeam.id == team_id).first()
            if not team:
                logger.error(f"❌ [TIME-{team_id}] ERRO: Team não encontrado")
                raise ValueError(f"Team {team_id} não encontrado")
            
            logger.info(f"👑 [TIME-{team_id}] TEAM: {team.name} - Líder: {team.leader_agent_id}")

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
                AgentModel.is_active == True
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
                logger.info(f"👤 [TIME-{team_id}] MEMBRO: {result.name} (ID: {result.agent_id}) - {result.role}")

            if not team_members:
                logger.error(f"❌ [TIME-{team_id}] ERRO: Nenhum membro ativo encontrado")
                raise ValueError(f"Nenhum membro ativo encontrado para o team {team_id}")
            
            logger.info(f"👥 [TIME-{team_id}] MEMBROS CARREGADOS: {len(team_members)} agentes")

            # Buscar líder separadamente (pode não estar nos membros)
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
                    logger.info(f"👑 [TIME-{team_id}] LÍDER CARREGADO: {leader.name} (ID: {leader.id}) - {leader.role}")

            if not leader_config:
                logger.error(f"❌ [TIME-{team_id}] ERRO: Líder não encontrado ou inativo")
                raise ValueError(f"Líder do team {team_id} não encontrado ou inativo")

            # Preparar contexto da conversa para o líder
            context_text = ""
            if context_history:
                context_text = "\\n\\n--- HISTÓRICO DA CONVERSA ---\\n"
                logger.info(f"📜 [TIME-{team_id}] PROCESSANDO HISTÓRICO DE {len(context_history)} mensagens:")
                
                for i, msg in enumerate(context_history):
                    msg_type = msg.get('type', 'unknown')
                    content = msg.get('content', '')
                    timestamp = msg.get('timestamp', '')
                    sender_info = msg.get('metadata', {}).get('sender', 'unknown')
                    
                    logger.info(f"   📝 [TIME-{team_id}] MSG {i+1}: [{msg_type.upper()}] {sender_info} -> {content[:100]}...")
                    
                    if msg_type == 'user':
                        context_text += f"[USUÁRIO]: {content}\\n"
                    elif msg_type == 'team':
                        context_text += f"[EQUIPE]: {content}\\n"
                    elif msg_type == 'agent':
                        context_text += f"[AGENTE]: {content}\\n"
                
                context_text += "--- FIM DO HISTÓRICO ---\\n\\n"
                logger.info(f"📜 [TIME-{team_id}] CONTEXTO PREPARADO: {len(context_text)} caracteres")

            # Determinar estratégia de delegação baseada no time
            delegation_strategy = self._determine_delegation_strategy(team, team_members, task)
            logger.info(f"🎯 [TIME-{team_id}] ESTRATÉGIA DE DELEGAÇÃO: {delegation_strategy}")

            # Executar com base na estratégia
            if delegation_strategy == "specific_model_matching":
                return self._execute_with_model_matching(team_id, team, team_members, leader_config, task, context_text, context_history, start_time)
            else:
                return self._execute_with_flexible_delegation(team_id, team, team_members, leader_config, task, context_text, context_history, start_time)

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            
            logger.error(f"💥 [TIME-{team_id}] ERRO NA EXECUÇÃO: {str(e)}")
            logger.error(f"⏱️ [TIME-{team_id}] TEMPO ATÉ ERRO: {execution_time}ms")
            
            error_agents = [m.get('name') for m in team_members] if 'team_members' in locals() else []
            logger.error(f"👥 [TIME-{team_id}] AGENTES DISPONÍVEIS NO MOMENTO DO ERRO: {error_agents}")

            return {
                "task": task,
                "error": str(e),
                "agents_involved": error_agents,
                "execution_time_ms": execution_time,
                "success": False,
                "timestamp": datetime.now().isoformat()
            }

    def _determine_delegation_strategy(self, team, team_members: List[Dict], task: str) -> str:
        """
        Determina qual estratégia de delegação usar baseada no time e contexto
        """
        # Verificar se algum membro tem padrão específico de máquinas agrícolas no nome
        machine_patterns = ['CH570', 'CH670', 'A9000', 'A8000', 'A8800', 'A8810', 'A9900', 'CH950', 'TC', 'Plantio']
        
        for member in team_members:
            member_name = member.get('name', '')
            if any(pattern in member_name for pattern in machine_patterns):
                logger.info(f"🔧 [TEAM] DETECTADO TIME COM ESPECIALISTAS EM MÁQUINAS: {member_name}")
                return "specific_model_matching"
        
        # Estratégia flexível para todos os outros casos
        logger.info(f"🌟 [TEAM] USANDO ESTRATÉGIA FLEXÍVEL PARA TIME: {team.name}")
        return "flexible_delegation"

    def _execute_with_model_matching(self, team_id: int, team, team_members: List[Dict], 
                                   leader_config: Dict, task: str, context_text: str,
                                   context_history: List[Dict], start_time: float) -> Dict:
        """
        Execução com estratégia específica para máquinas agrícolas (lógica original)
        """
        logger.info(f"🚜 [TIME-{team_id}] EXECUTANDO COM ESTRATÉGIA ESPECÍFICA DE MÁQUINAS")
        
        # Criar mapeamento de modelos específicos
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
            elif 'TC' in member_name:
                model_mapping['TC'] = member_name
            elif 'Plantio' in member_name or 'plantio' in member_name:
                model_mapping['Plantio'] = member_name

        # Verificar se deve delegar baseado no contexto
        should_delegate = False
        target_specialist = None
        
        # Verificar se a pergunta atual ou contexto menciona modelo específico
        # IMPORTANTE: Incluir apenas mensagens do usuário para evitar detectar modelos nas próprias respostas
        combined_text = task.lower()
        if context_history:
            for msg in context_history[-3:]:  # Últimas 3 mensagens para contexto
                if msg.get('type', '') == 'user':  # Apenas mensagens do usuário
                    combined_text += " " + msg.get('content', '').lower()
        
        # Buscar por modelos específicos no texto (ordenado por especificidade)
        logger.info(f"🔍 [TIME-{team_id}] ANALISANDO PARA DELEGAÇÃO: '{combined_text[:200]}...'")
        
        # Ordenar por tamanho decrescente para priorizar matches mais específicos
        sorted_models = sorted(model_mapping.items(), key=lambda x: len(x[0]), reverse=True)
        logger.info(f"🗺️ [TIME-{team_id}] ORDEM DE TESTE: {[k for k, v in sorted_models]}")
        
        for model_key, specialist_name in sorted_models:
            # Fazer match mais preciso com word boundaries
            pattern = r'\b' + re.escape(model_key.lower()) + r'\b'
            match_result = re.search(pattern, combined_text.lower())
            if match_result:
                should_delegate = True
                target_specialist = next((m for m in team_members if m['name'] == specialist_name), None)
                logger.info(f"✅ [TIME-{team_id}] MODELO DETECTADO: {model_key} -> DELEGANDO PARA: {specialist_name}")
                logger.info(f"🔎 [TIME-{team_id}] MATCH ENCONTRADO: '{match_result.group()}' na posição {match_result.start()}-{match_result.end()}")
                logger.info(f"📝 [TIME-{team_id}] CONTEXTO DO MATCH: '...{combined_text[max(0, match_result.start()-10):match_result.end()+10]}...'")
                break
            else:
                logger.info(f"❌ [TIME-{team_id}] MODELO {model_key} NÃO ENCONTRADO (pattern: '{pattern}')")

        if should_delegate and target_specialist:
            return self._execute_specialist_directly(team_id, target_specialist, task, context_text, start_time, leader_config)
        else:
            # Líder responde com contexto de triagem específica
            leader_context = f"""
            {context_text}
            Você é o líder de uma equipe de especialistas em máquinas agrícolas. 
            
            Para esta tarefa: "{task}"
            
            Especialistas disponíveis: {', '.join(model_mapping.keys()) if model_mapping else 'Nenhum'}
            
            Se não conseguir identificar a máquina específica, pergunte qual modelo o usuário está usando.
            Se conseguir identificar, explique que você está encaminhando para o especialista apropriado.
            """
            return self._execute_leader_response(team_id, leader_config, leader_context, task, start_time)

    def _execute_with_flexible_delegation(self, team_id: int, team, team_members: List[Dict],
                                        leader_config: Dict, task: str, context_text: str,
                                        context_history: List[Dict], start_time: float) -> Dict:
        """
        Execução flexível que permite diferentes estratégias de delegação
        """
        logger.info(f"🌟 [TIME-{team_id}] EXECUTANDO COM ESTRATÉGIA FLEXÍVEL")
        
        # Encontrar o melhor agente baseado na tarefa e competências
        best_agent = self._find_best_agent_for_task(team_members, task, context_text)
        
        if best_agent:
            logger.info(f"🎯 [TIME-{team_id}] MELHOR AGENTE ENCONTRADO: {best_agent['name']} - {best_agent['role']}")
            return self._execute_specialist_directly(team_id, best_agent, task, context_text, start_time, leader_config)
        else:
            # Líder coordena colaborativamente
            leader_context = f"""
            {context_text}
            
            Você é o líder desta equipe. Para a tarefa: "{task}"
            
            Membros disponíveis:
            {chr(10).join([f"- {m.get('name')}: {m.get('role', 'Assistente')} - {m.get('description', 'Sem descrição')[:100]}" for m in team_members])}
            
            Analise a tarefa e:
            1. Se algum membro específico seria ideal, mencione que está delegando para ele
            2. Se for uma questão geral, responda diretamente usando sua expertise de liderança
            3. Se precisar de informações específicas, coordene a resposta baseada nas competências da equipe
            
            Sua função é coordenar e fornecer a melhor resposta possível.
            """
            return self._execute_leader_response(team_id, leader_config, leader_context, task, start_time)

    def _find_best_agent_for_task(self, team_members: List[Dict], task: str, context: str) -> Optional[Dict]:
        """
        Encontra o melhor agente para uma tarefa específica baseado em competências
        """
        task_lower = task.lower()
        
        # Pontuação por agente baseada na relevância
        agent_scores = []
        
        for agent in team_members:
            score = 0
            
            # Pontuação baseada na descrição/especialidade
            description = agent.get('description', '').lower()
            instructions = agent.get('instructions', '').lower()
            role = agent.get('role', '').lower()
            
            # Verificar correspondências nas instruções e descrições
            combined_agent_info = f"{description} {instructions} {role}"
            
            # Palavras-chave da tarefa presentes na descrição do agente
            task_words = set(task_lower.split())
            agent_words = set(combined_agent_info.split())
            common_words = task_words.intersection(agent_words)
            score += len(common_words) * 2
            
            # Pontuação extra se o agente tem coleções RAG associadas
            agent_collections = self.get_agent_collections(agent.get('id', 0))
            if agent_collections:
                score += len(agent_collections) * 3
            
            if score > 0:
                agent_scores.append((agent, score))
                logger.info(f"📊 [AGENT-MATCH] {agent['name']}: score {score} (palavras comuns: {len(common_words)}, coleções: {len(agent_collections)})")
        
        # Retornar o agente com maior pontuação, se houver uma diferença significativa
        if agent_scores:
            agent_scores.sort(key=lambda x: x[1], reverse=True)
            best_agent, best_score = agent_scores[0]
            
            # Só delegar se o score for significativo (> 3) e melhor que os outros
            if best_score >= 3:
                if len(agent_scores) == 1 or best_score > agent_scores[1][1] * 1.5:
                    return best_agent
        
        return None

    def _execute_specialist_directly(self, team_id: int, specialist: Dict, task: str, 
                                   context_text: str, start_time: float, leader_config: Dict) -> Dict:
        """
        Executa um especialista específico diretamente
        """
        logger.info(f"👨‍🔧 [TIME-{team_id}] EXECUTANDO ESPECIALISTA: {specialist['name']}")
        
        # BUSCA RAG AUTOMÁTICA ANTES DA EXECUÇÃO
        rag_context = ""
        agent_id = specialist['id']
        
        # Buscar coleções RAG do agente especialista
        agent_collections = self.get_agent_collections(agent_id)
        if agent_collections:
            logger.info(f"🔍 [TIME-{team_id}] FAZENDO BUSCA RAG AUTOMÁTICA PARA ESPECIALISTA...")
            collection_names = [col['name'] for col in agent_collections]
            logger.info(f"📚 [TIME-{team_id}] COLEÇÕES DISPONÍVEIS: {collection_names}")
            
            # Criar instância RAG temporária para busca
            temp_rag = QdrantRAGTool(self.qdrant_service, collection_names, self.db)
            
            try:
                # Fazer busca automática com termos da tarefa
                initial_results = temp_rag.search(task, limit=5)
                if initial_results and not any('error' in str(r) for r in initial_results):
                    logger.info(f"✅ [TIME-{team_id}] BUSCA RAG CONCLUÍDA: {len(initial_results)} resultados")
                    rag_context = "\n\n🗄️ INFORMAÇÕES DAS BASES DE CONHECIMENTO:\n"
                    for i, result in enumerate(initial_results[:3]):
                        content = result.get('text', result.get('content', ''))
                        rag_context += f"{i+1}. {content[:500]}...\n\n"
                    rag_context += "📋 Use essas informações como base para sua resposta.\n"
                else:
                    logger.warning(f"⚠️ [TIME-{team_id}] BUSCA RAG SEM RESULTADOS VÁLIDOS")
            except Exception as e:
                logger.error(f"❌ [TIME-{team_id}] ERRO NA BUSCA RAG: {e}")
        else:
            logger.info(f"ℹ️ [TIME-{team_id}] ESPECIALISTA SEM COLEÇÕES RAG ASSOCIADAS")

        specialist_context = f"""
        {context_text}
        
        Você é {specialist['name']} - {specialist.get('role', 'Especialista')}.
        
        Tarefa: {task}
        
        {rag_context}
        
        Forneça uma resposta técnica detalhada baseada na sua especialidade e conhecimento.
        """
        
        specialist_agent = self._get_or_create_agent(specialist['id'], specialist)
        response = specialist_agent.run(specialist_context)
        
        # Processar resposta
        response_content = response.content if hasattr(response, 'content') else str(response)
        execution_time = int((time.time() - start_time) * 1000)
        
        logger.info(f"✅ [TIME-{team_id}] ESPECIALISTA RESPONDEU: {len(response_content)} caracteres")
        
        # Capturar informações de RAG para resposta
        rag_info = {"rag_used": False, "searches": []}
        if rag_context:
            rag_info = {
                "rag_used": True,
                "searches": [{"query": task[:100], "results_count": len(initial_results) if 'initial_results' in locals() else 0}],
                "total_searches": 1,
                "total_results": len(initial_results) if 'initial_results' in locals() else 0,
                "collections_searched": collection_names if 'collection_names' in locals() else []
            }
            logger.info(f"🗄️ [TIME-{team_id}] RAG USADO: {rag_info['total_results']} resultados de {len(rag_info['collections_searched'])} coleções")
        
        return {
            "task": task,
            "team_response": response_content,
            "agents_involved": [leader_config['name'], specialist['name']],
            "execution_time_ms": execution_time,
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "delegation_type": "specialist_direct",
            "rag_info": rag_info
        }

    def _execute_leader_response(self, team_id: int, leader_config: Dict, leader_context: str, task: str, start_time: float) -> Dict:
        """
        Executa resposta direta do líder
        """
        logger.info(f"👑 [TIME-{team_id}] EXECUTANDO LÍDER: {leader_config['name']}")
        
        leader_agent = self._get_or_create_agent(leader_config['id'], leader_config)
        response = leader_agent.run(leader_context)
        
        # Processar resposta
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
            model=OpenAIChat(
                id=agent_config.get('model', 'gpt-4o-mini'),
                temperature=agent_config.get('temperature', 0.7)
            ),
            instructions=agent_config.get('instructions', ''),
            tools=tools,
            debug_mode=False,
            markdown=True
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