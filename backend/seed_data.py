"""
Função para criar dados de exemplo - executada automaticamente no startup se necessário
"""
import logging
from database import SessionLocal
from agent_models import Agent, AgentCollection, AgentTeam, TeamMember
from models import Collection as CollectionModel

logger = logging.getLogger(__name__)

def ensure_sample_data():
    """
    Verifica se existem dados de exemplo e cria se necessário
    """
    db = SessionLocal()
    
    try:
        # Verificar se já temos dados
        agent_count = db.query(Agent).count()
        collection_count = db.query(CollectionModel).count()
        
        if agent_count > 0 and collection_count > 0:
            logger.info(f"✅ Dados já existem: {agent_count} agentes, {collection_count} coleções")
            return
        
        logger.info("🌱 Criando dados de exemplo...")
        
        # 1. Criar coleções de exemplo
        collections_data = [
            {"name": "Manuais CH570", "description": "Documentação técnica das máquinas CH570", "vector_size": 384, "distance_metric": "cosine"},
            {"name": "Manuais A9000", "description": "Documentação dos equipamentos A9000", "vector_size": 384, "distance_metric": "cosine"},
            {"name": "Políticas Empresa", "description": "Políticas e procedimentos internos", "vector_size": 384, "distance_metric": "cosine"},
            {"name": "FAQ Suporte", "description": "Base de conhecimento FAQ", "vector_size": 384, "distance_metric": "cosine"},
        ]
        
        collections = []
        for coll_data in collections_data:
            collection = CollectionModel(**coll_data)
            db.add(collection)
            collections.append(collection)
            logger.info(f"  📚 Coleção: {coll_data['name']}")
        
        db.commit()
        
        # 2. Criar agentes de exemplo
        agents_data = [
            {
                "name": "Especialista CH570", 
                "description": "Especialista técnico em máquinas CH570",
                "role": "Técnico CH570",
                "model": "gpt-4o-mini",
                "temperature": 0.2,
                "instructions": "Você é especialista em máquinas CH570. Consulte sempre a documentação técnica.",
                "is_active": True
            },
            {
                "name": "Especialista A9000",
                "description": "Especialista em equipamentos A9000", 
                "role": "Técnico A9000",
                "model": "gpt-4o-mini",
                "temperature": 0.2,
                "instructions": "Você é especialista em equipamentos A9000. Use informações da base técnica.",
                "is_active": True
            },
            {
                "name": "Assistente Políticas",
                "description": "Especialista em políticas e procedimentos da empresa",
                "role": "Compliance",
                "model": "gpt-4o-mini", 
                "temperature": 0.3,
                "instructions": "Você ajuda com políticas da empresa. Cite sempre as políticas específicas.",
                "is_active": True
            },
            {
                "name": "Supervisor Técnico",
                "description": "Coordenador geral de suporte técnico",
                "role": "Supervisor",
                "model": "gpt-4o",
                "temperature": 0.4,
                "instructions": "Você coordena o suporte técnico e faz triagem de problemas complexos.",
                "is_active": True
            }
        ]
        
        agents = []
        for agent_data in agents_data:
            agent = Agent(**agent_data)
            db.add(agent)
            agents.append(agent)
            logger.info(f"  🤖 Agente: {agent_data['name']}")
        
        db.commit()
        
        # 3. Associar agentes às coleções (aguardar IDs serem criados)
        db.refresh(collections[0])  # CH570
        db.refresh(collections[1])  # A9000  
        db.refresh(collections[2])  # Políticas
        db.refresh(collections[3])  # FAQ
        
        db.refresh(agents[0])  # CH570
        db.refresh(agents[1])  # A9000
        db.refresh(agents[2])  # Políticas
        db.refresh(agents[3])  # Supervisor
        
        associations = [
            # Especialista CH570 -> Manuais CH570 + FAQ
            {"agent": agents[0], "collection": collections[0], "priority": 10},
            {"agent": agents[0], "collection": collections[3], "priority": 8},
            
            # Especialista A9000 -> Manuais A9000 + FAQ
            {"agent": agents[1], "collection": collections[1], "priority": 10},
            {"agent": agents[1], "collection": collections[3], "priority": 7},
            
            # Assistente Políticas -> Políticas
            {"agent": agents[2], "collection": collections[2], "priority": 10},
            
            # Supervisor -> Todas as coleções
            {"agent": agents[3], "collection": collections[0], "priority": 5},
            {"agent": agents[3], "collection": collections[1], "priority": 5},
            {"agent": agents[3], "collection": collections[2], "priority": 6},
            {"agent": agents[3], "collection": collections[3], "priority": 8},
        ]
        
        for assoc in associations:
            agent_collection = AgentCollection(
                agent_id=assoc["agent"].id,
                collection_id=assoc["collection"].id,
                access_level="read",
                priority=assoc["priority"]
            )
            db.add(agent_collection)
            logger.info(f"  🔗 Associação: {assoc['agent'].name} -> {assoc['collection'].name}")
        
        db.commit()
        
        # 4. Criar time de suporte
        team = AgentTeam(
            name="Time de Suporte Técnico",
            description="Equipe principal de suporte com especialistas técnicos",
            leader_agent_id=agents[3].id  # Supervisor como líder
        )
        db.add(team)
        db.commit()
        db.refresh(team)
        
        # Adicionar membros ao time
        for i in range(3):  # Adicionar os 3 primeiros agentes como membros
            team_member = TeamMember(
                team_id=team.id,
                agent_id=agents[i].id,
                role_in_team="member"
            )
            db.add(team_member)
        
        db.commit()
        logger.info(f"  👥 Time criado: {team.name} com 3 membros + 1 líder")
        
        logger.info("🎉 Dados de exemplo criados com sucesso!")
        logger.info(f"  📚 {len(collections)} coleções")
        logger.info(f"  🤖 {len(agents)} agentes") 
        logger.info(f"  🔗 {len(associations)} associações")
        logger.info(f"  👥 1 time de suporte")
        
    except Exception as e:
        logger.error(f"❌ Erro ao criar dados de exemplo: {e}")
        db.rollback()
        raise
    finally:
        db.close()