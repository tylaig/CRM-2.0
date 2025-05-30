import express, { type Express, Request, Response, NextFunction } from "express";
import { WebSocketServer, WebSocket } from "ws";

// Estender a interface Request para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: string;
      };
    }
  }
}
import { storage } from "./storage";
import { db } from "./db";
import axios from "axios";
import { eq } from "drizzle-orm";
import { 
  insertDealSchema, 
  insertPipelineStageSchema, 
  insertSettingsSchema,
  insertClientMachineSchema,
  insertLossReasonSchema,
  insertQuoteItemSchema,
  insertLeadActivitySchema,
  insertMachineBrandSchema,
  insertMachineModelSchema,
  insertLeadSchema,
  insertSalePerformanceReasonSchema,
  insertNotificationSchema,
  deals,
  Deal,
  SalePerformanceReason,
  salePerformanceReasons,
  pipelineStages,
  machineModels,
  machineBrands,
  users,
  notifications
} from "@shared/schema";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// Armazenar conexões WebSocket
const wsClients = new Map<number, WebSocket[]>(); // userId -> WebSocket[]

// Função para broadcast via WebSocket
function broadcastUpdate(type: string, data: any) {
  console.log(`Broadcast: ${type}`, data);
  
  // Enviar para todos os clientes conectados se for uma atualização geral
  if (type === 'deals_updated' || type === 'stages_updated') {
    wsClients.forEach((clients) => {
      clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type, data }));
        }
      });
    });
  }
}

// Função para criar notificação
async function createNotification(userId: number, dealId: number | null, pipelineId: number, type: string, title: string, message: string) {
  try {
    const [notification] = await db.insert(notifications).values({
      userId,
      dealId,
      pipelineId,
      type,
      title,
      message,
      isRead: false
    }).returning();

    // Enviar notificação via WebSocket para o usuário específico
    const userClients = wsClients.get(userId);
    if (userClients) {
      userClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'notification',
            data: notification
          }));
        }
      });
    }

    return notification;
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
  }
}

// Função para notificar usuários sobre deals criados/movidos para um pipeline
async function notifyPipelineActivity(dealId: number, pipelineId: number, type: 'created' | 'moved', dealName: string) {
  try {
    // Buscar todos os usuários ativos
    const allUsers = await db.select().from(users);
    
    const title = type === 'created' ? 'Novo Lead Criado' : 'Lead Movido';
    const message = type === 'created' 
      ? `Novo lead "${dealName}" foi criado no pipeline`
      : `Lead "${dealName}" foi movido para este pipeline`;

    // Criar notificação para todos os usuários
    for (const user of allUsers) {
      await createNotification(user.id, dealId, pipelineId, `deal_${type}`, title, message);
    }
  } catch (error) {
    console.error('Erro ao notificar atividade do pipeline:', error);
  }
}

// Função para registrar atividades automaticamente
async function logActivity(dealId: number, activityType: string, description: string, userId?: number) {
  try {
    let createdBy = 'system';
    
    // Se um userId foi fornecido, buscar o email do usuário via API
    if (userId) {
      try {
        const users = await storage.getUsers();
        const user = users.find(u => u.id === userId);
        if (user) {
          createdBy = user.email;
        } else {
          createdBy = `User ID ${userId}`;
        }
      } catch (error) {
        console.error('Erro ao buscar usuário para atividade:', error);
        createdBy = `User ID ${userId}`;
      }
    }
    
    await storage.createLeadActivity({
      dealId,
      activityType,
      description,
      createdBy
    });
  } catch (error) {
    console.error('Erro ao registrar atividade:', error);
  }
}

// Função utilitária para gerar token
function generateToken(user: any) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

// Middleware de autenticação
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token não fornecido" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido" });
  }
}

// Middleware para proteger rotas de admin
function adminOnly(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ message: 'Apenas administradores podem executar esta ação.' });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Express> {
  // API routes
  const apiRouter = express.Router();
  
  // Pipelines routes
  apiRouter.get("/pipelines", async (req: Request, res: Response) => {
    try {
      const pipelines = await storage.getPipelines();
      res.json(pipelines);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pipelines" });
    }
  });

  apiRouter.get("/pipelines/default", async (req: Request, res: Response) => {
    try {
      const pipeline = await storage.getDefaultPipeline();
      res.json(pipeline);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch default pipeline" });
    }
  });

  apiRouter.get("/pipelines/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const pipeline = await storage.getPipeline(id);
      if (!pipeline) {
        return res.status(404).json({ message: "Pipeline not found" });
      }
      
      res.json(pipeline);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pipeline" });
    }
  });

  // Pipeline Stages routes
  apiRouter.get("/pipeline-stages", async (req: Request, res: Response) => {
    try {
      const pipelineId = req.query.pipelineId ? parseInt(req.query.pipelineId as string) : undefined;
      let stages;
      
      if (pipelineId) {
        // Buscar estágios de um pipeline específico
        stages = await storage.getPipelineStages(pipelineId);
      } else {
        // Buscar TODOS os estágios de TODOS os pipelines
        stages = await storage.getAllPipelineStages();
      }
      
      res.json(stages);
    } catch (error) {
      console.error("Error fetching pipeline stages:", error);
      res.status(500).json({ message: "Failed to fetch pipeline stages" });
    }
  });
  
  apiRouter.post("/pipeline-stages", async (req: Request, res: Response) => {
    try {
      const validatedData = insertPipelineStageSchema.parse(req.body);
      const stage = await storage.createPipelineStage(validatedData);
      res.status(201).json(stage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create pipeline stage" });
      }
    }
  });
  
  apiRouter.put("/pipeline-stages/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const validatedData = insertPipelineStageSchema.partial().parse(req.body);
      const updatedStage = await storage.updatePipelineStage(id, validatedData);
      
      if (!updatedStage) {
        return res.status(404).json({ message: "Pipeline stage not found" });
      }
      
      res.json(updatedStage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update pipeline stage" });
      }
    }
  });
  
  apiRouter.delete("/pipeline-stages/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const success = await storage.deletePipelineStage(id);
      if (!success) {
        return res.status(404).json({ message: "Pipeline stage not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir estágio:", error);
      res.status(500).json({ message: "Failed to delete pipeline stage" });
    }
  });
  
  // Deals routes
  apiRouter.get("/deals", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user || !user.id) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      const stageId = req.query.stageId ? parseInt(req.query.stageId as string) : undefined;
      const pipelineId = req.query.pipelineId ? parseInt(req.query.pipelineId as string) : undefined;
      const filterUserId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      
      let deals;
      
      if (user.role === 'admin') {
        // Admin pode ver todos ou filtrar por userId
        if (typeof stageId === 'number' && !isNaN(stageId)) {
          deals = await storage.getDealsByStage(stageId);
        } else if (typeof pipelineId === 'number' && !isNaN(pipelineId)) {
          deals = await storage.getDeals(pipelineId);
        } else {
          deals = await storage.getDeals();
        }
        if (filterUserId) {
          deals = deals.filter((deal: any) => deal.userId === filterUserId);
        }
      } else {
        // Usuário comum só vê seus próprios negócios
        if (typeof stageId === 'number' && !isNaN(stageId)) {
          deals = (await storage.getDealsByStage(stageId)).filter((deal: any) => deal.userId === user.id);
        } else if (typeof pipelineId === 'number' && !isNaN(pipelineId)) {
          deals = (await storage.getDeals(pipelineId)).filter((deal: any) => deal.userId === user.id);
        } else {
          deals = (await storage.getDeals()).filter((deal: any) => deal.userId === user.id);
        }
      }
      
      // Aplicar filtro adicional por pipelineId se especificado (garante que apenas deals do pipeline correto sejam retornados)
      if (typeof pipelineId === 'number' && !isNaN(pipelineId)) {
        deals = deals.filter((deal: any) => deal.pipelineId === pipelineId);
      }
      // Enriquecer os deals com informações do lead e do usuário criador
      const enrichedDeals = await Promise.all(
        deals.map(async (deal: any) => {
          const lead = await storage.getLead(deal.leadId);
          let creatorUserEmail = '';
          if (typeof deal.userId === 'number') {
            try {
              const creatorUser = await storage.getUser(deal.userId);
              creatorUserEmail = creatorUser?.email || '';
            } catch (e) {
              creatorUserEmail = '';
            }
          }
          return {
            ...deal,
            leadData: lead ? {
              name: lead.name || '',
              companyName: lead.companyName || '',
              phone: lead.phone || '',
              email: lead.email || ''
            } : { name: '', companyName: '', phone: '', email: '' },
            creatorUserId: deal.userId, // para exibir no frontend
            creatorUserEmail // novo campo
          };
        })
      );
      res.json(enrichedDeals);
    } catch (error) {
      console.error("Erro ao buscar deals:", error);
      res.status(500).json({ message: "Failed to fetch deals" });
    }
  });
  
  apiRouter.post("/deals", authMiddleware, async (req: Request, res: Response) => {
    try {
      console.log("Recebendo dados do negócio:", JSON.stringify(req.body));
      
      // Verifica se leadId está presente
      if (!req.body.leadId) {
        console.error("Faltando campo obrigatório leadId");
        return res.status(400).json({
          message: "Campo obrigatório 'leadId' está faltando ou é inválido",
          details: "O ID do lead é necessário para associar o negócio ao contato"
        });
      }
      
      // Verifica se o lead realmente existe
      const lead = await storage.getLead(req.body.leadId);
      if (!lead) {
        console.error(`Lead com ID ${req.body.leadId} não encontrado`);
        return res.status(404).json({
          message: "Lead não encontrado",
          details: `Não foi possível encontrar um lead com o ID ${req.body.leadId}`
        });
      }
      
      // Validação dos dados
      let validatedData;
      try {
        validatedData = insertDealSchema.parse(req.body);
        console.log("Dados do negócio validados com sucesso:", JSON.stringify(validatedData));
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          console.error("Erro de validação:", JSON.stringify(validationError.errors));
          return res.status(400).json({ 
            message: "Dados inválidos para criação do negócio", 
            errors: validationError.errors 
          });
        }
        throw validationError;
      }
      
      // Verificar se o stageId está definido, caso contrário, usar o estágio padrão
      if (!validatedData.stageId) {
        const stages = await storage.getPipelineStages();
        if (stages && stages.length > 0) {
          // Usar o primeiro estágio como padrão
          validatedData.stageId = stages[0].id;
          console.log(`StageId não fornecido, usando estágio padrão: ${validatedData.stageId}`);
        } else {
          return res.status(400).json({ 
            message: "Não foi possível criar o negócio porque não há estágios definidos. Crie pelo menos um estágio primeiro."
          });
        }
      }
      
      // Adicionar o userId do usuário autenticado
      const user = (req as any).user;
      if (!user || !user.id) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      validatedData.userId = user.id;
      
      try {
        const deal = await storage.createDeal(validatedData);
        console.log("Negócio criado com sucesso:", JSON.stringify(deal));
        
        // Criar notificação para todos os usuários
        await notifyPipelineActivity(deal.id, deal.pipelineId, 'created', deal.name);
        
        // Broadcast da criação WebSocket
        broadcastUpdate('deal:created', {
          dealId: deal.id,
          deal: deal
        });
        
        res.status(201).json(deal);
      } catch (dbError) {
        console.error("Erro no banco de dados ao criar negócio:", dbError);
        res.status(500).json({ 
          message: "Falha ao criar o negócio no banco de dados", 
          error: dbError instanceof Error ? dbError.message : String(dbError),
          details: "Erro ao inserir os dados no banco. Verifique os logs do servidor."
        });
      }
    } catch (error) {
      console.error("Erro não tratado ao criar negócio:", error);
      res.status(500).json({ 
        message: "Falha geral ao criar o negócio", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  apiRouter.put("/deals/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      // Verificar se é atualização normal ou do drag-and-drop
      const id = parseInt(req.params.id);
      const { dealId, stageId, order, saleStatus } = req.body;
      
      // Se recebemos dealId no corpo, este é um request do drag-and-drop
      const targetId = dealId || id;
      
      if (isNaN(targetId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      // Buscar o deal atual
      const existingDeal = await storage.getDeal(targetId);
      if (!existingDeal) {
        return res.status(404).json({ message: "Deal not found" });
      }
      
      // Caso especial: atualização do drag-and-drop (ordem ou stage)
      if (dealId) {
        let updateData: Partial<Deal> = {};
        
        // Se recebemos nova ordem, atualizamos apenas isso
        if (order !== undefined) {
          updateData.order = order;
        }
        
        // Se recebemos novo stageId, atualizamos o estágio
        if (stageId !== undefined) {
          updateData.stageId = stageId;
          
          // Registrar atividade de mudança de etapa
          if (existingDeal.stageId !== stageId) {
            // Buscar etapas usando o storage que funciona corretamente
            try {
              // Buscar todas as etapas disponíveis
              const allStages = await storage.getAllPipelineStages();
              const oldStage = allStages.find(s => s.id === existingDeal.stageId);
              const newStage = allStages.find(s => s.id === stageId);

              const oldStageName = oldStage?.name || 'Etapa Removida';
              const newStageName = newStage?.name || 'Etapa Não Encontrada';
              
              console.log('=== DEBUG NOMES DAS ETAPAS ===');
              console.log('Etapa antiga ID:', existingDeal.stageId, 'Nome:', oldStageName);
              console.log('Etapa nova ID:', stageId, 'Nome:', newStageName);
              console.log('Total de etapas encontradas:', allStages.length);
              console.log('==============================');
              
              await logActivity(
                targetId,
                'stage_change',
                `Negócio movido da etapa "${oldStageName}" para "${newStageName}"`,
                req.user?.id
              );
              
              // Broadcast para invalidar cache de atividades
              broadcastUpdate('activities:updated', {
                dealId: targetId,
                timestamp: new Date().toISOString()
              });
            } catch (error) {
              console.error('Erro ao buscar nomes das etapas:', error);
              await logActivity(
                targetId,
                'stage_change',
                `Negócio movido entre etapas (ID ${existingDeal.stageId} → ${stageId})`,
                req.user?.id
              );
            }
          }
          
          // Verificar se houve mudança de pipeline também
          if (updateData.stageId) {
            const allStages = await storage.getPipelineStages();
            const newStage = allStages.find(s => s.id === updateData.stageId);
            if (newStage && newStage.pipelineId !== existingDeal.pipelineId) {
              const pipelines = await storage.getPipelines();
              const oldPipeline = pipelines.find(p => p.id === existingDeal.pipelineId);
              const newPipeline = pipelines.find(p => p.id === newStage.pipelineId);
              
              // Atualizar o pipeline do deal
              updateData.pipelineId = newStage.pipelineId;
              
              await logActivity(
                targetId,
                'pipeline_change',
                `Negócio movido do pipeline "${oldPipeline?.name || 'Desconhecido'}" para "${newPipeline?.name || 'Desconhecido'}"`,
                req.user?.id
              );
            }
          }
        }
        
        const updatedDeal = await storage.updateDeal(targetId, updateData);
        
        // Broadcast da atualização WebSocket
        broadcastUpdate('deal:updated', {
          dealId: targetId,
          deal: updatedDeal,
          action: 'stage_moved'
        });
        
        return res.json(updatedDeal);
      }
      
      // Atualização normal via formulário
      const validatedData = insertDealSchema.partial().parse(req.body);
      
      // Lógica para mover automaticamente para estágios de vendas realizadas/perdidas
      // APENAS se o saleStatus foi explicitamente definido E não há mudança manual de stageId
      if (validatedData.saleStatus && !validatedData.stageId) {
        // Buscar o pipeline atual do deal ou usar o pipeline padrão
        const currentPipeline = existingDeal.pipelineId;
        const stages = await storage.getPipelineStages(currentPipeline);
        
        // Encontrar estágios de vendas realizadas e perdidas no pipeline atual
        const wonStage = stages.find(stage => stage.stageType === 'completed');
        const lostStage = stages.find(stage => stage.stageType === 'lost');
        
        // Mover para o estágio correto baseado no status da venda
        if (validatedData.saleStatus === 'won' && wonStage) {
          validatedData.stageId = wonStage.id;
          
          // Registrar atividade de venda realizada
          const reasonText = validatedData.salePerformanceReasonId ? 
            ` (${await storage.getSalePerformanceReasons().then(reasons => 
              reasons.find(r => r.id === validatedData.salePerformanceReasonId)?.reason || 'Motivo não especificado'
            )})` : '';
          
          await logActivity(
            targetId,
            'sale_won',
            `Negócio marcado como Venda Realizada${reasonText}`,
            req.user?.id
          );
        } else if (validatedData.saleStatus === 'lost' && lostStage) {
          validatedData.stageId = lostStage.id;
          
          // Registrar atividade de venda perdida
          const reasonText = validatedData.lossReasonId ? 
            ` (${await storage.getLossReasons().then(reasons => 
              reasons.find(r => r.id === validatedData.lossReasonId)?.reason || 'Motivo não especificado'
            )})` : '';
          
          await logActivity(
            targetId,
            'sale_lost',
            `Negócio marcado como Venda Perdida${reasonText}`,
            req.user?.id
          );
        }
      }
      
      // Sincronização bidirecional com Chatwoot
      if (validatedData.name && 
          validatedData.name !== existingDeal.name && 
          existingDeal.chatwootContactId) {
        
        try {
          // Obter configurações do Chatwoot
          const settings = await storage.getSettings();
          
          if (settings?.chatwootApiKey && settings?.chatwootUrl && settings?.accountId) {
            // Atualizar o nome do contato no Chatwoot
            await axios.put(
              `${settings.chatwootUrl}/api/v1/accounts/${settings.accountId}/contacts/${existingDeal.chatwootContactId}`,
              {
                name: validatedData.name,
                // Se tivermos outros campos que queremos sincronizar, podemos adicionar aqui
                email: validatedData.email || existingDeal.email,
                phone_number: validatedData.phone || existingDeal.phone
              },
              {
                headers: {
                  'api_access_token': settings.chatwootApiKey
                }
              }
            );
            
            console.log(`Contato Chatwoot ID ${existingDeal.chatwootContactId} sincronizado com nome: ${validatedData.name}`);
          }
        } catch (chatwootError) {
          console.error("Erro ao sincronizar com Chatwoot:", chatwootError);
          // Continuamos com a atualização local mesmo se a sincronização falhar
        }
      }
      
      // Verificar se o estágio mudou para registrar atividade
      const stageChanged = validatedData.stageId && validatedData.stageId !== existingDeal.stageId;
      
      const updatedDeal = await storage.updateDeal(targetId, validatedData);
      
      if (!updatedDeal) {
        return res.status(404).json({ message: "Deal not found" });
      }
      
      // Registrar atividade de mudança de estágio se houve alteração
      if (stageChanged) {
        try {
          // Buscar todos os estágios para encontrar os nomes corretos
          const allStages = await storage.getAllPipelineStages();
          const oldStage = allStages.find(s => s.id === existingDeal.stageId);
          const newStage = allStages.find(s => s.id === validatedData.stageId);
          
          const oldStageName = oldStage?.name || `Estágio ID ${existingDeal.stageId}`;
          const newStageName = newStage?.name || `Estágio ID ${validatedData.stageId}`;
          
          await logActivity(
            targetId,
            'stage_moved',
            `Lead movido de "${oldStageName}" para "${newStageName}"`,
            req.user?.id
          );
          
          console.log(`Atividade registrada: ${oldStageName} → ${newStageName}`);
        } catch (error) {
          console.error("Erro ao registrar atividade de mudança de estágio:", error);
          // Continua mesmo se falhar o registro da atividade
        }
      }
      
      // Broadcast da atualização em tempo real
      broadcastUpdate('deal:updated', {
        dealId: targetId,
        deal: updatedDeal,
        action: stageId !== undefined ? 'stage_moved' : 'updated',
        timestamp: new Date().toISOString()
      });
      
      // Se houve mudança nas notas, enviar broadcast específico
      if (validatedData.notes !== undefined) {
        broadcastUpdate('notes:updated', {
          dealId: targetId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Se houve mudança de pipeline, enviar broadcast específico
      if (validatedData.pipelineId !== undefined) {
        broadcastUpdate('pipeline:changed', {
          dealId: targetId,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json(updatedDeal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Error updating deal:", error);
        res.status(500).json({ message: "Failed to update deal" });
      }
    }
  });
  
  apiRouter.delete("/deals/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const success = await storage.deleteDeal(id);
      if (!success) {
        return res.status(404).json({ message: "Deal not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete deal" });
    }
  });
  
  // Rota para obter negócios por status de venda (won, lost)
  apiRouter.get("/deals/sale-status/:status", async (req: Request, res: Response) => {
    try {
      const status = req.params.status;
      if (status !== "won" && status !== "lost") {
        return res.status(400).json({ message: "Invalid status. Use 'won' or 'lost'" });
      }
      
      const deals = await storage.getDealsBySaleStatus(status);
      res.json(deals);
    } catch (error) {
      console.error(`Error getting ${req.params.status} deals:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Obter todos os negócios de um mesmo cliente (por chatwootContactId)
  apiRouter.get("/deals/contact/:contactId", async (req: Request, res: Response) => {
    try {
      const contactId = req.params.contactId;
      if (!contactId) {
        return res.status(400).json({ message: "Contact ID is required" });
      }
      
      const deals = await storage.getDealsByContactId(contactId);
      res.json(deals);
    } catch (error) {
      console.error(`Error getting deals for contact ${req.params.contactId}:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Configurações do CRM
  apiRouter.get("/settings", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });
  
  apiRouter.post("/settings", async (req: Request, res: Response) => {
    try {
      const validatedData = insertSettingsSchema.parse(req.body);
      const settings = await storage.updateSettings(validatedData);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update settings" });
      }
    }
  });
  
  // Chatwoot routes
  apiRouter.get("/chatwoot/contacts", async (req: Request, res: Response) => {
    try {
      // Usar credenciais das variáveis de ambiente primeiro
      const chatwootUrl = process.env.CHATWOOT_URL;
      const chatwootApiKey = process.env.CHATWOOT_API_KEY;
      const accountId = process.env.CHATWOOT_ACCOUNT_ID;
      
      let finalUrl, finalApiKey, finalAccountId;
      
      if (chatwootUrl && chatwootApiKey && accountId) {
        finalUrl = chatwootUrl;
        finalApiKey = chatwootApiKey;
        finalAccountId = accountId;
        console.log("Using environment variables for Chatwoot API");
      } else {
        const settings = await storage.getSettings();
        if (!settings || !settings.chatwootApiKey || !settings.chatwootUrl || !settings.accountId) {
          return res.status(400).json({ message: "Chatwoot API not configured" });
        }
        finalUrl = settings.chatwootUrl;
        finalApiKey = settings.chatwootApiKey;
        finalAccountId = settings.accountId;
        console.log("Using database settings for Chatwoot API");
      }
      
      // Verificar se existe um termo de busca na query
      const searchQuery = req.query.q as string;
      const page = req.query.page || 1;
      
      let chatwootApiUrl = `${finalUrl}/api/v1/accounts/${finalAccountId}/contacts`;
      
      // Se houver busca, usar a API de busca do Chatwoot
      if (searchQuery && searchQuery.trim()) {
        chatwootApiUrl += `?q=${encodeURIComponent(searchQuery.trim())}`;
        
        console.log(`Searching Chatwoot contacts: ${chatwootApiUrl}`);
        
        const response = await axios.get(chatwootApiUrl, {
          headers: { 'api_access_token': finalApiKey }
        });
        
        console.log(`Search results: ${response.data?.payload?.length || 0} contacts found`);
        return res.json(response.data);
      }
      
      // Buscar todos os contatos do Chatwoot usando paginação fixa até página 6
      let allContacts = [];
      
      try {
        console.log(`Fetching contacts from: ${chatwootApiUrl}`);
        
        // Buscar páginas 1 a 6 para garantir que pegamos todos os contatos
        for (let page = 1; page <= 6; page++) {
          console.log(`Fetching page ${page}...`);
          
          const response = await axios.get(chatwootApiUrl, {
            headers: { 
              'api_access_token': finalApiKey
            },
            params: {
              page: page,
              per_page: 15
            }
          });
          
          if (response.data?.payload && response.data.payload.length > 0) {
            allContacts.push(...response.data.payload);
            console.log(`Page ${page}: ${response.data.payload.length} contacts added`);
          } else {
            console.log(`Page ${page}: No contacts found`);
            break; // Para se não há mais contatos
          }
        }
        
        console.log(`Total contacts fetched: ${allContacts.length} from ${Math.min(6, allContacts.length / 15 + 1)} pages`);
      } catch (error) {
        console.log("Error fetching contacts:", error.response?.data || error.message);
        return res.status(500).json({ 
          message: "Failed to fetch contacts from Chatwoot",
          error: error.response?.data || error.message
        });
      }
      
      // Remover duplicatas baseado no ID
      const uniqueContacts = allContacts.filter((contact, index, self) => 
        index === self.findIndex(c => c.id === contact.id)
      );
      
      // Ordenar por ID decrescente para mostrar mais recentes primeiro
      uniqueContacts.sort((a, b) => (b.id || 0) - (a.id || 0));
      
      console.log(`Total unique contacts: ${uniqueContacts.length}`);
      
      res.json({
        payload: uniqueContacts,
        meta: {
          count: uniqueContacts.length,
          current_page: 1,
          total_pages: 1
        }
      });
    } catch (error) {
      console.error("Error fetching Chatwoot contacts:", error);
      if (axios.isAxiosError(error)) {
        console.error("Chatwoot API error response:", error.response?.data);
        res.status(error.response?.status || 500).json({
          message: "Failed to fetch Chatwoot contacts",
          error: error.response?.data || error.message
        });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  // Endpoint de diagnóstico para debug da API Chatwoot
  apiRouter.get("/chatwoot/debug", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSettings();
      
      if (!settings || !settings.chatwootApiKey || !settings.chatwootUrl || !settings.accountId) {
        return res.status(400).json({ message: "Chatwoot API not configured" });
      }
      
      console.log("=== CHATWOOT DEBUG ===");
      console.log("URL:", settings.chatwootUrl);
      console.log("Account ID:", settings.accountId);
      console.log("API Key length:", settings.chatwootApiKey?.length);
      
      // Testar endpoint de contatos com diferentes parâmetros
      const debugResults = [];
      
      // Teste 1: Busca básica
      try {
        const basicUrl = `${settings.chatwootUrl}/api/v1/accounts/${settings.accountId}/contacts`;
        console.log("Testing basic URL:", basicUrl);
        
        const basicResponse = await axios.get(basicUrl, {
          headers: { 'api_access_token': settings.chatwootApiKey }
        });
        
        debugResults.push({
          test: "basic_fetch",
          url: basicUrl,
          status: basicResponse.status,
          contacts_count: basicResponse.data?.payload?.length || 0,
          meta: basicResponse.data?.meta
        });
      } catch (error) {
        debugResults.push({
          test: "basic_fetch",
          error: error.response?.data || error.message
        });
      }
      
      // Teste 2: Com paginação explícita
      try {
        const paginatedUrl = `${settings.chatwootUrl}/api/v1/accounts/${settings.accountId}/contacts?page=1&per_page=50`;
        console.log("Testing paginated URL:", paginatedUrl);
        
        const paginatedResponse = await axios.get(paginatedUrl, {
          headers: { 'api_access_token': settings.chatwootApiKey }
        });
        
        debugResults.push({
          test: "paginated_fetch",
          url: paginatedUrl,
          status: paginatedResponse.status,
          contacts_count: paginatedResponse.data?.payload?.length || 0,
          meta: paginatedResponse.data?.meta
        });
      } catch (error) {
        debugResults.push({
          test: "paginated_fetch",
          error: error.response?.data || error.message
        });
      }
      
      // Teste 3: Buscar conta para verificar configuração
      try {
        const accountUrl = `${settings.chatwootUrl}/api/v1/accounts/${settings.accountId}`;
        console.log("Testing account URL:", accountUrl);
        
        const accountResponse = await axios.get(accountUrl, {
          headers: { 'api_access_token': settings.chatwootApiKey }
        });
        
        debugResults.push({
          test: "account_info",
          url: accountUrl,
          status: accountResponse.status,
          account_data: accountResponse.data
        });
      } catch (error) {
        debugResults.push({
          test: "account_info",
          error: error.response?.data || error.message
        });
      }
      
      console.log("Debug results:", JSON.stringify(debugResults, null, 2));
      
      res.json({
        message: "Chatwoot API Debug Results",
        results: debugResults
      });
      
    } catch (error) {
      console.error("Debug error:", error);
      res.status(500).json({ message: "Debug failed", error: error.message });
    }
  });

  // Rota para criar novo contato no Chatwoot
  apiRouter.post("/chatwoot/contacts", async (req: Request, res: Response) => {
    try {
      // Usar credenciais das variáveis de ambiente primeiro
      const chatwootUrl = process.env.CHATWOOT_URL;
      const chatwootApiKey = process.env.CHATWOOT_API_KEY;
      const accountId = process.env.CHATWOOT_ACCOUNT_ID;
      
      let finalUrl, finalApiKey, finalAccountId;
      
      if (chatwootUrl && chatwootApiKey && accountId) {
        finalUrl = chatwootUrl;
        finalApiKey = chatwootApiKey;
        finalAccountId = accountId;
        console.log("Using environment variables for Chatwoot API");
      } else {
        const settings = await storage.getSettings();
        if (!settings || !settings.chatwootApiKey || !settings.chatwootUrl || !settings.accountId) {
          return res.status(400).json({ message: "Chatwoot API not configured" });
        }
        finalUrl = settings.chatwootUrl;
        finalApiKey = settings.chatwootApiKey;
        finalAccountId = settings.accountId;
        console.log("Using database settings for Chatwoot API");
      }
      
      // Validar os dados necessários para criar um contato
      const { name, email, phone_number, company_name } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }
      
      // Preparar os dados para enviar ao Chatwoot
      const contactData = {
        name: name,
        email: email || undefined,
        phone_number: phone_number || undefined,
        custom_attributes: {
          company_name: company_name || undefined,
          source: "CRM (manual)",
          created_via: "CRM"
        }
      };
      
      console.log("Criando contato com dados:", JSON.stringify(contactData, null, 2));
      
      // Criar o contato no Chatwoot
      const chatwootApiUrl = `${finalUrl}/api/v1/accounts/${finalAccountId}/contacts`;
      console.log("URL de criação:", chatwootApiUrl);
      
      const response = await axios.post(
        chatwootApiUrl,
        contactData,
        {
          headers: {
            'api_access_token': finalApiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log("Resposta do Chatwoot:", {
        status: response.status,
        data: response.data
      });
      
      // Verificar se o contato foi criado com sucesso
      if (response.status === 200 || response.status === 201) {
        const createdContact = response.data?.payload?.contact;
        console.log("Contato criado com sucesso:", createdContact);
        
        // Aguardar um pouco para garantir que o contato seja processado
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verificar se o contato aparece na listagem
        try {
          const verifyUrl = `${finalUrl}/api/v1/accounts/${finalAccountId}/contacts/${createdContact?.id}`;
          const verifyResponse = await axios.get(verifyUrl, {
            headers: { 'api_access_token': finalApiKey }
          });
          console.log("Contato verificado após criação:", verifyResponse.data);
        } catch (verifyError) {
          console.log("Erro ao verificar contato após criação:", verifyError.response?.data);
        }
        
        // Retornar os dados do contato criado
        res.status(201).json({
          message: "Contato criado com sucesso no Chatwoot",
          contact: response.data
        });
      } else {
        res.status(response.status).json({
          message: "Erro ao criar contato no Chatwoot",
          apiResponse: response.data
        });
      }
    } catch (error) {
      console.error("Erro ao criar contato no Chatwoot:", error);
      
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status || 500;
        const errorData = error.response?.data || {};
        
        // Detecção de erros específicos do Chatwoot
        let errorMessage = "Erro ao criar contato no Chatwoot";
        
        if (errorData.message) {
          if (errorData.message.includes("Phone number has already been taken")) {
            errorMessage = "Este número de telefone já está cadastrado para outro contato.";
          } else if (errorData.message.includes("Email has already been taken")) {
            errorMessage = "O email informado já está sendo usado por outro contato.";
          } else if (errorData.message.includes("Phone number should be in e164 format")) {
            errorMessage = "O número de telefone precisa estar no formato internacional (+5531999999999).";
          } else {
            errorMessage = `Erro ao criar contato: ${errorData.message}`;
          }
        }
        
        res.status(statusCode).json({
          message: errorMessage,
          details: errorData
        });
      } else {
        res.status(500).json({ 
          message: "Erro interno ao criar contato no Chatwoot",
          details: error instanceof Error ? error.message : "Erro desconhecido"
        });
      }
    }
  });
  
  // Busca avançada de leads/contatos
  apiRouter.get("/leads/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      
      if (!query) {
        return res.status(400).json({ 
          message: "É necessário fornecer um termo de busca",
          results: []
        });
      }
      
      // Verificar se é uma busca por ID do Chatwoot
      if (/^\d+$/.test(query.trim())) {
        // Se for um número, tenta buscar pelo chatwootContactId
        const lead = await storage.getLeadByChatwootId(query.trim());
        if (lead) {
          return res.json({ results: [lead] });
        } else {
          // Se não achou, retorna um array vazio (não é erro)
          return res.json({ results: [] });
        }
      }
      
      // Para buscas de texto, exige pelo menos 2 caracteres
      if (query.trim().length < 2) {
        return res.status(400).json({ 
          message: "O termo de busca deve ter pelo menos 2 caracteres",
          results: []
        });
      }
      
      // Caso contrário, busca normal por texto
      const results = await storage.searchLeads(query.trim());
      res.json({ results });
    } catch (error) {
      console.error("Erro ao buscar leads:", error);
      res.status(500).json({ 
        message: "Erro ao buscar leads", 
        results: [] 
      });
    }
  });
  
  // Obter lead pelo ID
  apiRouter.get("/leads/:id", async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id, 10);
      if (isNaN(leadId)) {
        return res.status(400).json({ message: "ID do lead inválido" });
      }
      
      const lead = await storage.getLead(leadId);
      if (!lead) {
        return res.status(404).json({ message: `Lead com ID ${leadId} não encontrado` });
      }
      
      res.json(lead);
    } catch (error) {
      console.error(`Erro ao buscar lead ${req.params.id}:`, error);
      res.status(500).json({ 
        message: "Erro ao buscar lead", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Criar novo lead
  apiRouter.post("/leads", async (req: Request, res: Response) => {
    try {
      console.log("Recebendo dados do lead:", JSON.stringify(req.body));
      const validatedData = insertLeadSchema.parse(req.body);
      console.log("Dados validados com sucesso:", JSON.stringify(validatedData));
      
      // Verificar se existe campo 'isCompany' que não está no esquema
      if ('isCompany' in req.body) {
        delete req.body.isCompany; // remover campo não mapeado
      }
      
      const lead = await storage.createLead(validatedData);
      console.log("Lead criado com sucesso:", JSON.stringify(lead));
      res.status(201).json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Erro de validação:", JSON.stringify(error.errors));
        res.status(400).json({
          message: "Dados inválidos",
          errors: error.errors
        });
      } else {
        console.error("Erro ao criar lead:", error);
        // Enviar mensagem mais detalhada
        res.status(500).json({ 
          message: "Erro interno do servidor", 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });
  
  // Atualizar lead existente
  apiRouter.put("/leads/:id", async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id, 10);
      if (isNaN(leadId)) {
        return res.status(400).json({ message: "ID do lead inválido" });
      }

      console.log(`Atualizando lead com ID ${leadId}:`, JSON.stringify(req.body));
      
      // Verificar se o lead existe
      const existingLead = await storage.getLead(leadId);
      if (!existingLead) {
        return res.status(404).json({ message: `Lead com ID ${leadId} não encontrado` });
      }
      
      // Remover campo isCompany se existir (não está no esquema)
      if ('isCompany' in req.body) {
        delete req.body.isCompany;
      }
      
      // Validar apenas os campos presentes na requisição
      const partialLeadSchema = insertLeadSchema.partial();
      const validatedData = partialLeadSchema.parse(req.body);
      console.log("Dados validados com sucesso:", JSON.stringify(validatedData));
      
      // Atualizar o lead
      const updatedLead = await storage.updateLead(leadId, validatedData);
      if (!updatedLead) {
        return res.status(500).json({ message: "Falha ao atualizar o lead" });
      }
      
      console.log("Lead atualizado com sucesso:", JSON.stringify(updatedLead));
      res.json(updatedLead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Erro de validação:", JSON.stringify(error.errors));
        res.status(400).json({
          message: "Dados inválidos",
          errors: error.errors
        });
      } else {
        console.error("Erro ao atualizar lead:", error);
        res.status(500).json({
          message: "Erro ao atualizar lead",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });
  
  // Update a Chatwoot contact
  apiRouter.put("/chatwoot/contact/:id", async (req: Request, res: Response) => {
    try {
      const contactId = req.params.id;
      const { name, email, phone_number, company_name } = req.body;
      
      const settings = await storage.getSettings();
      
      if (!settings || !settings.chatwootApiKey || !settings.chatwootUrl || !settings.accountId) {
        return res.status(400).json({ message: "Chatwoot API not configured" });
      }
      
      const response = await axios.put(
        `${settings.chatwootUrl}/api/v1/accounts/${settings.accountId}/contacts/${contactId}`,
        {
          name,
          email,
          phone_number,
          company_name
        },
        {
          headers: {
            'api_access_token': settings.chatwootApiKey
          }
        }
      );
      
      res.json(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        res.status(error.response?.status || 500).json({
          message: "Failed to update Chatwoot contact",
          error: error.response?.data || error.message
        });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Sync contacts from Chatwoot
  // Endpoint para sincronizar os estágios dos negócios de acordo com o status
  apiRouter.post("/deals/sync-stages", async (req: Request, res: Response) => {
    try {
      // Buscar todos os estágios
      const allStages = await storage.getPipelineStages();
      
      // Obter estágios "completed" e "lost" para cada pipeline
      const completedStages = allStages.filter(stage => stage.stageType === "completed");
      const lostStages = allStages.filter(stage => stage.stageType === "lost");
      
      // Mapear pipelines para seus estágios "completed" e "lost"
      const pipelineCompletedStages: { [key: number]: number } = {};
      const pipelineLostStages: { [key: number]: number } = {};
      
      completedStages.forEach(stage => {
        pipelineCompletedStages[stage.pipelineId] = stage.id;
      });
      
      lostStages.forEach(stage => {
        pipelineLostStages[stage.pipelineId] = stage.id;
      });
      
      // Buscar todos os negócios
      const allDeals = await storage.getDeals();
      
      // Filtrar negócios com status "won" ou "lost" que estão no estágio errado
      const dealsToUpdate: { id: number, stageId: number }[] = [];
      
      allDeals.forEach(deal => {
        // Para negócios "won", mover para o estágio "completed"
        if (deal.saleStatus === "won") {
          const correctStageId = pipelineCompletedStages[deal.pipelineId];
          if (correctStageId && deal.stageId !== correctStageId) {
            dealsToUpdate.push({ id: deal.id, stageId: correctStageId });
          }
        }
        
        // Para negócios "lost", mover para o estágio "lost"
        if (deal.saleStatus === "lost") {
          const correctStageId = pipelineLostStages[deal.pipelineId];
          if (correctStageId && deal.stageId !== correctStageId) {
            dealsToUpdate.push({ id: deal.id, stageId: correctStageId });
          }
        }
      });
      
      // Atualizar os negócios
      console.log(`Sincronizando ${dealsToUpdate.length} negócios para os estágios corretos`);
      
      const updatePromises = dealsToUpdate.map(update => 
        storage.updateDeal(update.id, { stageId: update.stageId })
      );
      
      await Promise.all(updatePromises);
      
      res.json({ 
        success: true, 
        message: `${dealsToUpdate.length} negócios sincronizados`, 
        updatedDeals: dealsToUpdate 
      });
    } catch (error) {
      console.error("Erro ao sincronizar estágios:", error);
      res.status(500).json({ success: false, message: "Erro ao sincronizar estágios" });
    }
  });
  
  apiRouter.post("/chatwoot/sync", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSettings();
      
      if (!settings || !settings.chatwootApiKey || !settings.chatwootUrl || !settings.accountId) {
        return res.status(400).json({ message: "Chatwoot API not configured" });
      }
      
      // Get contacts from Chatwoot
      const response = await axios.get(
        `${settings.chatwootUrl}/api/v1/accounts/${settings.accountId}/contacts`,
        {
          headers: {
            'api_access_token': settings.chatwootApiKey
          }
        }
      );
      
      const contacts = response.data.payload || [];
      const existingDeals = await storage.getDeals();
      
      // Não criamos negócios automaticamente para contatos
      // Apenas atualizamos os já existentes
      
      // Para cada deal com um chatwootContactId, atualizar informações se necessário
      let updatedDealsCount = 0;
      for (const deal of existingDeals) {
        if (!deal.chatwootContactId) continue;
        
        const chatwootContact = contacts.find((c: any) => c.id.toString() === deal.chatwootContactId);
        if (!chatwootContact) continue;
        
        try {
          // Atualizar informações do contato vindas do Chatwoot
          const updateData: Partial<Deal> = {};
          let needsUpdate = false;
          
          if (chatwootContact.name && chatwootContact.name !== deal.contactName) {
            updateData.contactName = chatwootContact.name;
            needsUpdate = true;
          }
          
          if (chatwootContact.company_name && chatwootContact.company_name !== deal.companyName) {
            updateData.companyName = chatwootContact.company_name;
            needsUpdate = true;
          }
          
          if (chatwootContact.email && chatwootContact.email !== deal.email) {
            updateData.email = chatwootContact.email;
            needsUpdate = true;
          }
          
          if (chatwootContact.phone_number && chatwootContact.phone_number !== deal.phone) {
            updateData.phone = chatwootContact.phone_number;
            needsUpdate = true;
          }
          
          // Obter informações da conversa para atualizar agente, se necessário
          try {
            const conversationsResponse = await axios.get(
              `${settings.chatwootUrl}/api/v1/accounts/${settings.accountId}/contacts/${deal.chatwootContactId}/conversations`,
              {
                headers: {
                  'api_access_token': settings.chatwootApiKey
                }
              }
            );
            
            if (conversationsResponse.data?.payload?.length > 0) {
              const conversation = conversationsResponse.data.payload[0];
              
              if (conversation.id && conversation.id.toString() !== deal.chatwootConversationId) {
                updateData.chatwootConversationId = conversation.id.toString();
                needsUpdate = true;
              }
              
              if (conversation.meta?.assignee) {
                const agentId = conversation.meta.assignee.id?.toString();
                const agentName = conversation.meta.assignee.name;
                
                if (agentId && agentId !== deal.chatwootAgentId) {
                  updateData.chatwootAgentId = agentId;
                  updateData.chatwootAgentName = agentName || 'Agente';
                  needsUpdate = true;
                }
              }
            }
          } catch (err) {
            console.error(`Erro ao obter conversas para o contato ${deal.chatwootContactId}:`, err);
          }
          
          // Só atualiza se houver mudanças
          if (needsUpdate) {
            await storage.updateDeal(deal.id, updateData);
            updatedDealsCount++;
          }
        } catch (error) {
          console.error(`Erro ao atualizar deal ${deal.id}:`, error);
        }
      }
      
      // Update last sync time
      await storage.updateSettings({
        ...settings,
        lastSyncAt: new Date()
      });
      
      res.json({
        success: true,
        synced: contacts.length,
        updated: updatedDealsCount,
        message: "Contatos sincronizados sem criar novos negócios"
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        res.status(error.response?.status || 500).json({
          message: "Failed to sync with Chatwoot",
          error: error.response?.data || error.message
        });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  // Lead Activities
  apiRouter.get("/lead-activities/:dealId", async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: "Invalid deal ID" });
      }
      
      const activities = await storage.getLeadActivities(dealId);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch lead activities" });
    }
  });
  
  apiRouter.post("/lead-activities", async (req: Request, res: Response) => {
    try {
      const validatedData = insertLeadActivitySchema.parse(req.body);
      const activity = await storage.createLeadActivity(validatedData);
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create lead activity" });
      }
    }
  });
  
  apiRouter.delete("/lead-activities/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const success = await storage.deleteLeadActivity(id);
      if (!success) {
        return res.status(404).json({ message: "Lead activity not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete lead activity" });
    }
  });
  
  // Client Machines
  apiRouter.get("/client-machines/:dealId", async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: "Invalid deal ID" });
      }
      
      const machines = await storage.getClientMachines(dealId);
      res.json(machines);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client machines" });
    }
  });
  
  apiRouter.post("/client-machines", async (req: Request, res: Response) => {
    try {
      const validatedData = insertClientMachineSchema.parse(req.body);
      const machine = await storage.createClientMachine(validatedData);
      res.status(201).json(machine);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create client machine" });
      }
    }
  });
  
  apiRouter.put("/client-machines/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const validatedData = insertClientMachineSchema.partial().parse(req.body);
      const updatedMachine = await storage.updateClientMachine(id, validatedData);
      
      if (!updatedMachine) {
        return res.status(404).json({ message: "Client machine not found" });
      }
      
      res.json(updatedMachine);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update client machine" });
      }
    }
  });
  
  apiRouter.delete("/client-machines/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const success = await storage.deleteClientMachine(id);
      if (!success) {
        return res.status(404).json({ message: "Client machine not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete client machine" });
    }
  });
  
  // Loss Reasons
  apiRouter.get("/loss-reasons", async (req: Request, res: Response) => {
    try {
      const reasons = await storage.getLossReasons();
      res.json(reasons);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch loss reasons" });
    }
  });
  
  apiRouter.post("/loss-reasons", async (req: Request, res: Response) => {
    try {
      const validatedData = insertLossReasonSchema.parse(req.body);
      const reason = await storage.createLossReason(validatedData);
      res.status(201).json(reason);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create loss reason" });
      }
    }
  });
  
  apiRouter.put("/loss-reasons/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const validatedData = insertLossReasonSchema.partial().parse(req.body);
      const updatedReason = await storage.updateLossReason(id, validatedData);
      
      if (!updatedReason) {
        return res.status(404).json({ message: "Loss reason not found" });
      }
      
      res.json(updatedReason);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Error updating loss reason:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  apiRouter.delete("/loss-reasons/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const success = await storage.deleteLossReason(id);
      if (!success) {
        return res.status(404).json({ message: "Loss reason not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete loss reason" });
    }
  });
  
  // Quote Items
  apiRouter.get("/quote-items/:dealId", async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: "Invalid deal ID" });
      }
      
      const items = await storage.getQuoteItems(dealId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quote items" });
    }
  });
  
  apiRouter.post("/quote-items", async (req: Request, res: Response) => {
    try {
      const validatedData = insertQuoteItemSchema.parse(req.body);
      const item = await storage.createQuoteItem(validatedData);
      
      // Registrar atividade de adição de item na cotação
      await logActivity(
        validatedData.dealId,
        'quote_item_added',
        `Item adicionado à cotação: ${validatedData.description} (Qtd: ${validatedData.quantity}, Valor: R$ ${validatedData.unitPrice.toFixed(2)})`,
        req.user?.id
      );
      
      // Broadcast para cotação atualizada
      broadcastUpdate('quote:updated', {
        dealId: validatedData.dealId,
        action: 'quote_added',
        timestamp: new Date().toISOString()
      });
      
      // Broadcast para atividades atualizadas
      broadcastUpdate('activities:updated', {
        dealId: validatedData.dealId,
        timestamp: new Date().toISOString()
      });
      
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create quote item" });
      }
    }
  });
  
  apiRouter.put("/quote-items/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const validatedData = insertQuoteItemSchema.partial().parse(req.body);
      const updatedItem = await storage.updateQuoteItem(id, validatedData);
      
      if (!updatedItem) {
        return res.status(404).json({ message: "Quote item not found" });
      }
      
      res.json(updatedItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update quote item" });
      }
    }
  });
  
  apiRouter.delete("/quote-items/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const success = await storage.deleteQuoteItem(id);
      if (!success) {
        return res.status(404).json({ message: "Quote item not found" });
      }
      
      // Broadcast genérico para cotação atualizada - será capturado por todos os deals
      broadcastUpdate('quote:updated', {
        action: 'quote_deleted',
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({ message: "Quote item deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete quote item" });
    }
  });
  
  // Machine Brands
  apiRouter.get("/machine-brands", async (req: Request, res: Response) => {
    try {
      const brands = await storage.getMachineBrands();
      res.json(brands);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch machine brands" });
    }
  });
  
  apiRouter.get("/machine-brands/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const brand = await storage.getMachineBrand(id);
      if (!brand) {
        return res.status(404).json({ message: "Machine brand not found" });
      }
      
      res.json(brand);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch machine brand" });
    }
  });
  
  apiRouter.post("/machine-brands", async (req: Request, res: Response) => {
    try {
      const validatedData = insertMachineBrandSchema.parse(req.body);
      const brand = await storage.createMachineBrand(validatedData);
      res.status(201).json(brand);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create machine brand" });
      }
    }
  });
  
  apiRouter.put("/machine-brands/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const validatedData = insertMachineBrandSchema.partial().parse(req.body);
      const updatedBrand = await storage.updateMachineBrand(id, validatedData);
      
      if (!updatedBrand) {
        return res.status(404).json({ message: "Machine brand not found" });
      }
      
      res.json(updatedBrand);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update machine brand" });
      }
    }
  });
  
  apiRouter.delete("/machine-brands/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const success = await storage.deleteMachineBrand(id);
      if (!success) {
        return res.status(404).json({ message: "Machine brand not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete machine brand" });
    }
  });

  // Rotas para Sale Performance Reasons
  apiRouter.get("/sale-performance-reasons", async (req: Request, res: Response) => {
    try {
      // Buscar motivos de desempenho de vendas
      const results = await storage.getSalePerformanceReasons();
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: `Erro ao buscar motivos de desempenho: ${error}` });
    }
  });

  apiRouter.post("/sale-performance-reasons", async (req: Request, res: Response) => {
    try {
      // Validar dados
      const validatedData = insertSalePerformanceReasonSchema.parse(req.body);
      
      // Criar motivo de desempenho
      const newData = {
        reason: validatedData.reason,
        value: validatedData.value,
        description: validatedData.description || null,
        active: validatedData.active || true,
        isSystem: validatedData.isSystem || false,
      };
      
      const newReason = await storage.createSalePerformanceReason(newData);
      
      res.status(201).json(newReason);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: `Erro ao criar motivo de desempenho: ${error}` });
    }
  });

  apiRouter.put("/sale-performance-reasons/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" });
      }
      
      // Validar dados
      const validatedData = insertSalePerformanceReasonSchema.partial().parse(req.body);
      
      // Atualizar motivo de desempenho
      const updatedReason = await storage.updateSalePerformanceReason(id, validatedData);
      
      if (!updatedReason) {
        return res.status(404).json({ error: "Motivo de desempenho não encontrado" });
      }
      
      res.json(updatedReason);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: `Erro ao atualizar motivo de desempenho: ${error}` });
    }
  });

  apiRouter.delete("/sale-performance-reasons/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" });
      }
      
      // Verificar se é um motivo do sistema
      const [reason] = await storage.db.select().from(salePerformanceReasons)
        .where(eq(salePerformanceReasons.id, id));
      
      if (!reason) {
        return res.status(404).json({ error: "Motivo de desempenho não encontrado" });
      }
      
      if (reason.isSystem) {
        return res.status(403).json({ error: "Não é possível excluir um motivo de desempenho do sistema" });
      }
      
      // Excluir motivo de desempenho
      const success = await storage.deleteSalePerformanceReason(id);
      
      if (!success) {
        return res.status(500).json({ error: "Erro ao excluir motivo de desempenho" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: `Erro ao excluir motivo de desempenho: ${error}` });
    }
  });

  // API Endpoints para modelos de máquinas
  apiRouter.get("/machine-models", async (req: Request, res: Response) => {
    try {
      const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : undefined;
      
      if (brandId) {
        // Se temos um brandId, vamos filtrar pelo id da marca
        const { db } = storage;
        const models = await db.select()
          .from(machineModels)
          .where(eq(machineModels.brandId, brandId))
          .orderBy(machineModels.name);
        
        console.log(`Buscando modelos para marca id=${brandId}, encontrados: ${models.length}`);
        return res.json(models);
      } else {
        // Sem brandId, retornar todos os modelos
        const { db } = storage;
        const models = await db.select()
          .from(machineModels)
          .orderBy(machineModels.name);
        
        console.log(`Buscando todos os modelos, encontrados: ${models.length}`);
        return res.json(models);
      }
    } catch (error) {
      console.error("Erro ao buscar modelos:", error);
      res.status(500).json({ error: `Erro ao buscar modelos de máquinas: ${error}` });
    }
  });

  apiRouter.post("/machine-models", async (req: Request, res: Response) => {
    try {
      const { name, brandId, active } = req.body;
      
      if (!name || !brandId) {
        return res.status(400).json({ error: "Nome e ID da marca são obrigatórios" });
      }

      console.log(`Tentando adicionar modelo: nome="${name}", brandId=${brandId}`);

      // Verificar se a marca existe
      const { db } = storage;
      const brands = await db.select().from(machineBrands)
        .where(eq(machineBrands.id, brandId));
      
      if (!brands.length) {
        console.log(`Marca não encontrada com ID ${brandId}`);
        return res.status(404).json({ error: "Marca não encontrada" });
      }
      
      console.log(`Marca encontrada: ${brands[0].name}`);
      
      try {
        // Inserir o novo modelo com validações explícitas
        const modelData = {
          name: String(name),
          brandId: Number(brandId),
          active: active !== undefined ? Boolean(active) : true,
        };
        
        console.log("Dados do modelo a inserir:", modelData);
        
        const newModels = await db.insert(machineModels)
          .values(modelData)
          .returning();
        
        if (!newModels.length) {
          throw new Error("Falha ao inserir: nenhum registro retornado");
        }
        
        console.log(`Modelo criado com sucesso: ID=${newModels[0].id}`);
        res.status(201).json(newModels[0]);
      } catch (insertError) {
        console.error("Erro ao inserir modelo:", insertError);
        throw insertError;
      }
    } catch (error) {
      console.error("Erro completo ao criar modelo:", error);
      res.status(500).json({ error: `Erro ao criar modelo de máquina: ${error}` });
    }
  });

  apiRouter.put("/machine-models/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" });
      }
      
      const { name, brandId, active } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Nome é obrigatório" });
      }

      // Verificar se o modelo existe
      const [existingModel] = await storage.db.select().from(machineModels)
        .where(eq(machineModels.id, id));
      
      if (!existingModel) {
        return res.status(404).json({ error: "Modelo não encontrado" });
      }
      
      // Verificar se a marca existe, se fornecida
      if (brandId) {
        const [brand] = await storage.db.select().from(machineBrands)
          .where(eq(machineBrands.id, brandId));
        
        if (!brand) {
          return res.status(404).json({ error: "Marca não encontrada" });
        }
      }
      
      // Atualizar o modelo
      const [updatedModel] = await storage.db.update(machineModels)
        .set({
          name,
          brandId: brandId || existingModel.brandId,
          active: active !== undefined ? active : existingModel.active,
        })
        .where(eq(machineModels.id, id))
        .returning();
      
      res.json(updatedModel);
    } catch (error) {
      res.status(500).json({ error: `Erro ao atualizar modelo de máquina: ${error}` });
    }
  });

  apiRouter.delete("/machine-models/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" });
      }
      
      // Verificar se o modelo existe
      const [model] = await storage.db.select().from(machineModels)
        .where(eq(machineModels.id, id));
      
      if (!model) {
        return res.status(404).json({ error: "Modelo não encontrado" });
      }
      
      // Excluir o modelo
      await storage.db.delete(machineModels)
        .where(eq(machineModels.id, id));
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: `Erro ao excluir modelo de máquina: ${error}` });
    }
  });

  // Rota de registro (liberada para qualquer usuário)
  apiRouter.post("/auth/register", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "E-mail e senha obrigatórios" });
    }
    const exists = await storage.getUserByEmail(email);
    if (exists) {
      return res.status(400).json({ message: "E-mail já cadastrado" });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ email, password: hashed });
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  });

  // Rota de login
  apiRouter.post("/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(400).json({ message: "E-mail ou senha inválidos" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "E-mail ou senha inválidos" });
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  });

  // Rota para admin criar novos usuários
  apiRouter.post("/auth/admin-create", authMiddleware, async (req: Request, res: Response) => {
    const userReq = (req as any).user;
    if (!userReq.isAdmin) return res.status(403).json({ message: "Apenas administradores podem criar usuários" });
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Usuário e senha obrigatórios" });
    const exists = await storage.getUserByUsername(username);
    if (exists) return res.status(400).json({ message: "Usuário já existe" });
    const hashed = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ username, password: hashed, isAdmin: false });
    res.json({ user: { id: user.id, username: user.username, isAdmin: false } });
  });

  // Rotas de gerenciamento de usuários (apenas admin)
  apiRouter.get("/users", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const users = await storage.getUsers();
      res.json(users.map(u => ({ id: u.id, email: u.email, role: u.role })));
    } catch (error) {
      res.status(500).json({ message: "Erro ao listar usuários" });
    }
  });

  apiRouter.post("/users", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const { email, password, role } = req.body;
      if (!email || !password || !role) {
        return res.status(400).json({ message: "E-mail, senha e role são obrigatórios" });
      }
      const exists = await storage.getUserByEmail(email);
      if (exists) {
        return res.status(400).json({ message: "E-mail já cadastrado" });
      }
      const hashed = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ email, password: hashed, role });
      res.status(201).json({ id: user.id, email: user.email, role: user.role });
    } catch (error) {
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  apiRouter.put("/users/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      const { email, role, password } = req.body;
      const updateData: any = {};
      if (email) updateData.email = email;
      if (role) updateData.role = role;
      if (password) updateData.password = await bcrypt.hash(password, 10);
      const updated = await storage.updateUser(id, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      res.json({ id: updated.id, email: updated.email, role: updated.role });
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });

  apiRouter.delete("/users/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      if (user.id === id) {
        return res.status(400).json({ message: "Você não pode excluir a si mesmo." });
      }
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir usuário" });
    }
  });

  // Rotas para notificações
  apiRouter.get("/notifications", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const userNotifications = await db.select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(notifications.createdAt);
      
      res.json(userNotifications);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      res.status(500).json({ message: "Erro ao buscar notificações" });
    }
  });

  apiRouter.put("/notifications/:id/read", authMiddleware, async (req: Request, res: Response) => {
    try {
      const notificationId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      if (isNaN(notificationId)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const [updated] = await db.update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, notificationId))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Notificação não encontrada" });
      }

      res.json(updated);
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      res.status(500).json({ message: "Erro ao marcar notificação como lida" });
    }
  });

  apiRouter.put("/notifications/read-all", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      
      await db.update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, userId));

      res.json({ message: "Todas as notificações foram marcadas como lidas" });
    } catch (error) {
      console.error('Erro ao marcar todas as notificações como lidas:', error);
      res.status(500).json({ message: "Erro ao marcar todas as notificações como lidas" });
    }
  });

  // Atualizar ordem dos deals em um estágio (apenas admin)
  apiRouter.put("/deals/order", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const { orders } = req.body; // [{id, order}]
      if (!Array.isArray(orders)) {
        return res.status(400).json({ message: "Formato inválido. Esperado: { orders: [{id, order}] }" });
      }
      // Atualizar todos os deals em batch
      for (const { id, order } of orders) {
        if (typeof id !== 'number' || typeof order !== 'number') continue;
        await storage.updateDeal(id, { order });
      }
      res.status(200).json({ message: "Ordem atualizada com sucesso" });
    } catch (error) {
      console.error("Erro ao atualizar ordem dos deals:", error);
      res.status(500).json({ message: "Erro ao atualizar ordem dos deals" });
    }
  });

  app.use("/api", apiRouter);
  
  return app;
}

// Função para configurar WebSocket server
export function setupWebSocketServer(httpServer: any) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('🔔 Nova conexão WebSocket estabelecida');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Registrar cliente por usuário quando receber userId
        if (data.type === 'register' && data.userId) {
          const userId = data.userId;
          if (!wsClients.has(userId)) {
            wsClients.set(userId, []);
          }
          wsClients.get(userId)!.push(ws);
          console.log(`🔔 Cliente registrado para usuário ${userId}`);
        }
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('🔔 Conexão WebSocket encerrada');
      // Remover cliente da lista quando desconectar
      wsClients.forEach((clients, userId) => {
        const index = clients.indexOf(ws);
        if (index !== -1) {
          clients.splice(index, 1);
          if (clients.length === 0) {
            wsClients.delete(userId);
          }
        }
      });
    });
    
    ws.on('error', (error) => {
      console.error('Erro na conexão WebSocket:', error);
    });
  });
  
  console.log('🔔 WebSocket server configurado em /ws');
  return wss;
}