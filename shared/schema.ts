import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users schema from original file
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default('user').notNull(), // 'admin' ou 'user'
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Leads/Contacts - Contatos/Leads
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  // Informações básicas do contato
  name: text("name").notNull(),
  companyName: text("company_name"),
  chatwootContactId: text("chatwoot_contact_id"),
  // Tipo de cliente
  clientCategory: text("client_category").default("final_consumer"), // "final_consumer" (Consumidor Final) ou "reseller" (Revenda)
  clientType: text("client_type").default("person"), // "person" (Pessoa Física) ou "company" (Pessoa Jurídica)
  cnpj: text("cnpj"),
  corporateName: text("corporate_name"), // razão social
  cpf: text("cpf"),
  stateRegistration: text("state_registration"), // inscrição estadual
  clientCodeSaoPaulo: text("client_code_sao_paulo"), // código Sisrev São Paulo
  clientCodePara: text("client_code_para"), // código Sisrev Pará
  // Contato
  email: text("email"),
  phone: text("phone"),
  // Endereço
  address: text("address"),
  addressNumber: text("address_number"),
  addressComplement: text("address_complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  // Campos do Chatwoot 
  chatwootAgentId: text("chatwoot_agent_id"), // ID do agente do Chatwoot responsável pelo contato
  chatwootAgentName: text("chatwoot_agent_name"), // Nome do agente do Chatwoot
  // Campos de rastreamento
  notes: text("notes"), // anotações gerais sobre o lead
  order: integer("order").default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).pick({
  name: true,
  companyName: true,
  chatwootContactId: true,
  clientCategory: true,
  clientType: true,
  cnpj: true,
  corporateName: true,
  cpf: true,
  stateRegistration: true,
  clientCodeSaoPaulo: true,
  clientCodePara: true,
  email: true,
  phone: true,
  address: true,
  addressNumber: true,
  addressComplement: true,
  neighborhood: true,
  city: true,
  state: true,
  zipCode: true,
  chatwootAgentId: true,
  chatwootAgentName: true,
  notes: true,
  order: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export const leadsRelations = relations(leads, ({ many }) => ({
  deals: many(deals)
}));

// Funis (Pipelines)
export const pipelines = pgTable("pipelines", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false), // Indica se é o funil padrão
  hasFixedStages: boolean("has_fixed_stages").default(true), // Indica se o funil tem os estágios fixos (Vendas Realizadas/Vendas Perdidas)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPipelineSchema = createInsertSchema(pipelines).pick({
  name: true,
  description: true,
  isDefault: true,
  hasFixedStages: true,
  isActive: true,
});

export type InsertPipeline = z.infer<typeof insertPipelineSchema>;
export type Pipeline = typeof pipelines.$inferSelect;

export const pipelinesRelations = relations(pipelines, ({ many }) => ({
  stages: many(pipelineStages),
}));

// Pipeline Stages
export const pipelineStages = pgTable("pipeline_stages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  pipelineId: integer("pipeline_id").notNull(), // ID do funil ao qual o estágio pertence
  isDefault: boolean("is_default").default(false), // Indica se o estágio é padrão para contatos importados
  isHidden: boolean("is_hidden").default(false),   // Indica se o estágio está oculto na visualização normal
  isSystem: boolean("is_system").default(false),   // Indica se o estágio é do sistema (não pode ser excluído)
  stageType: text("stage_type").default("normal"), // normal, completed, lost
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    pipelineIdForeignKey: foreignKey({
      columns: [table.pipelineId],
      foreignColumns: [pipelines.id],
    }),
  }
});

export const insertPipelineStageSchema = createInsertSchema(pipelineStages).pick({
  name: true,
  order: true,
  pipelineId: true,
  isDefault: true,
  isHidden: true,
  isSystem: true,
  stageType: true,
});

export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;

export const pipelineStagesRelations = relations(pipelineStages, ({ many, one }) => ({
  pipeline: one(pipelines, {
    fields: [pipelineStages.pipelineId],
    references: [pipelines.id],
  }),
  deals: many(deals),
  stageHistory: many(stageHistory),
}));

// Deals - Negócios
export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  leadId: integer("lead_id").notNull(),
  stageId: integer("stage_id").notNull(),
  pipelineId: integer("pipeline_id").notNull(), // ID do funil ao qual o negócio pertence
  userId: integer("user_id").notNull(), // Novo campo: usuário criador
  order: integer("order").default(0), // Posição do deal dentro do estágio para ordenação
  value: doublePrecision("value").default(0),
  quoteValue: doublePrecision("quote_value").default(0),
  status: text("status").default("in_progress"),
  // Status da venda
  saleStatus: text("sale_status").default("negotiation"), // negotiation, won, lost
  salePerformance: text("sale_performance"), // "below_quote", "above_quote", "according_to_quote"
  lostReason: text("lost_reason"), // motivo principal da perda
  lostNotes: text("lost_notes"), // observações sobre a perda
  notes: text("notes"), // anotações gerais do negócio
  // Campos do Chatwoot 
  chatwootConversationId: text("chatwoot_conversation_id"), // ID da conversa associada no Chatwoot
  // Campos de rastreamento
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  quoteCodeSao: text("quote_code_sao"), // Código Cotação São
  quoteCodePara: text("quote_code_para"), // Código Cotação Pará
}, (table) => {
  return {
    leadIdForeignKey: foreignKey({
      columns: [table.leadId],
      foreignColumns: [leads.id],
    }),
    stageIdForeignKey: foreignKey({
      columns: [table.stageId],
      foreignColumns: [pipelineStages.id],
    }),
    pipelineIdForeignKey: foreignKey({
      columns: [table.pipelineId],
      foreignColumns: [pipelines.id],
    }),
  }
});

export const insertDealSchema = createInsertSchema(deals).pick({
  name: true,
  leadId: true,
  stageId: true,
  pipelineId: true,
  userId: true,
  order: true,
  value: true,
  quoteValue: true,
  status: true,
  saleStatus: true,
  salePerformance: true,
  lostReason: true,
  lostNotes: true,
  notes: true,
  chatwootConversationId: true,
  quoteCodeSao: true,
  quoteCodePara: true,
});

export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

export const dealsRelations = relations(deals, ({ one, many }) => ({
  lead: one(leads, {
    fields: [deals.leadId],
    references: [leads.id],
  }),
  stage: one(pipelineStages, {
    fields: [deals.stageId],
    references: [pipelineStages.id],
  }),
  pipeline: one(pipelines, {
    fields: [deals.pipelineId],
    references: [pipelines.id],
  }),
  quoteItems: many(quoteItems),
  clientMachines: many(clientMachines),
  leadActivities: many(leadActivities),
}));

// Quote Items
export const quoteItems = pgTable("quote_items", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: doublePrecision("unit_price").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    dealIdForeignKey: foreignKey({
      columns: [table.dealId],
      foreignColumns: [deals.id],
    }),
  }
});

export const insertQuoteItemSchema = createInsertSchema(quoteItems).pick({
  dealId: true,
  description: true,
  quantity: true,
  unitPrice: true,
});

export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;
export type QuoteItem = typeof quoteItems.$inferSelect;

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  deal: one(deals, {
    fields: [quoteItems.dealId],
    references: [deals.id],
  }),
}));

// Stage History
export const stageHistory = pgTable("stage_history", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  stageId: integer("stage_id").notNull(),
  enteredAt: timestamp("entered_at").notNull().defaultNow(),
  leftAt: timestamp("left_at"),
}, (table) => {
  return {
    dealIdForeignKey: foreignKey({
      columns: [table.dealId],
      foreignColumns: [deals.id],
    }),
    stageIdForeignKey: foreignKey({
      columns: [table.stageId],
      foreignColumns: [pipelineStages.id],
    }),
  }
});

export const stageHistoryRelations = relations(stageHistory, ({ one }) => ({
  deal: one(deals, {
    fields: [stageHistory.dealId],
    references: [deals.id],
  }),
  stage: one(pipelineStages, {
    fields: [stageHistory.stageId],
    references: [pipelineStages.id],
  }),
}));

// Motivos de desempenho de venda
export const salePerformanceReasons = pgTable("sale_performance_reasons", {
  id: serial("id").primaryKey(),
  reason: text("reason").notNull(),                  // nome do motivo (ex: "Abaixo da cotação")
  value: text("value").notNull().unique(),           // valor para uso interno (ex: "below_quote")
  description: text("description"),                  // descrição para usuário
  active: boolean("active").default(true),
  isSystem: boolean("is_system").default(false),     // indica se é um motivo do sistema (não pode ser excluído)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSalePerformanceReasonSchema = createInsertSchema(salePerformanceReasons).pick({
  reason: true,
  value: true,
  description: true,
  active: true,
  isSystem: true,
});

export type InsertSalePerformanceReason = z.infer<typeof insertSalePerformanceReasonSchema>;
export type SalePerformanceReason = typeof salePerformanceReasons.$inferSelect;

// Settings
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  chatwootApiKey: text("chatwoot_api_key"),
  chatwootUrl: text("chatwoot_url"),
  accountId: text("account_id"),
  lastSyncAt: timestamp("last_sync_at"),
  activePipelineId: integer("active_pipeline_id"), // ID do funil ativo atualmente
});

export const insertSettingsSchema = createInsertSchema(settings).pick({
  chatwootApiKey: true,
  chatwootUrl: true,
  accountId: true,
  activePipelineId: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// Máquinas do cliente
export const clientMachines = pgTable("client_machines", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  name: text("name").notNull(),
  brand: text("brand").notNull(), // marca
  model: text("model").notNull(),
  year: text("year"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    dealIdForeignKey: foreignKey({
      columns: [table.dealId],
      foreignColumns: [deals.id],
    }),
  }
});

export const insertClientMachineSchema = createInsertSchema(clientMachines).pick({
  dealId: true,
  name: true,
  brand: true,
  model: true,
  year: true,
});

export type InsertClientMachine = z.infer<typeof insertClientMachineSchema>;
export type ClientMachine = typeof clientMachines.$inferSelect;

export const clientMachinesRelations = relations(clientMachines, ({ one }) => ({
  deal: one(deals, {
    fields: [clientMachines.dealId],
    references: [deals.id],
  }),
}));

// Motivos de perda de negócio
export const lossReasons = pgTable("loss_reasons", {
  id: serial("id").primaryKey(),
  reason: text("reason").notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLossReasonSchema = createInsertSchema(lossReasons).pick({
  reason: true,
  active: true,
});

export type InsertLossReason = z.infer<typeof insertLossReasonSchema>;
export type LossReason = typeof lossReasons.$inferSelect;

// Lead Activities
export const leadActivities = pgTable("lead_activities", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  activityType: text("activity_type").notNull(), // proposal_created, email_sent, call_made, meeting_scheduled, etc.
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"), // Nome de quem criou a atividade
}, (table) => {
  return {
    dealIdForeignKey: foreignKey({
      columns: [table.dealId],
      foreignColumns: [deals.id],
    }),
  }
});

export const insertLeadActivitySchema = createInsertSchema(leadActivities).pick({
  dealId: true,
  activityType: true,
  description: true,
  createdBy: true,
});

export type InsertLeadActivity = z.infer<typeof insertLeadActivitySchema>;
export type LeadActivity = typeof leadActivities.$inferSelect;

export const leadActivitiesRelations = relations(leadActivities, ({ one }) => ({
  deal: one(deals, {
    fields: [leadActivities.dealId],
    references: [deals.id],
  }),
}));

// Marcas de máquinas
export const machineBrands = pgTable("machine_brands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMachineBrandSchema = createInsertSchema(machineBrands).pick({
  name: true,
  description: true,
  active: true,
});

export type InsertMachineBrand = z.infer<typeof insertMachineBrandSchema>;
export type MachineBrand = typeof machineBrands.$inferSelect;

export const machineBrandsRelations = relations(machineBrands, ({ many }) => ({
  models: many(machineModels)
}));

// Modelos de máquinas
export const machineModels = pgTable("machine_models", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  brandId: integer("brand_id").notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    brandIdForeignKey: foreignKey({
      columns: [table.brandId],
      foreignColumns: [machineBrands.id],
    }),
  }
});

export const insertMachineModelSchema = createInsertSchema(machineModels).pick({
  name: true,
  brandId: true,
  active: true,
});

export type InsertMachineModel = z.infer<typeof insertMachineModelSchema>;
export type MachineModel = typeof machineModels.$inferSelect;

export const machineModelsRelations = relations(machineModels, ({ one }) => ({
  brand: one(machineBrands, {
    fields: [machineModels.brandId],
    references: [machineBrands.id],
  }),
}));
