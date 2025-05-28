CREATE TABLE "client_machines" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"year" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lead_id" integer NOT NULL,
	"stage_id" integer NOT NULL,
	"pipeline_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"order" integer DEFAULT 0,
	"value" double precision DEFAULT 0,
	"quote_value" double precision DEFAULT 0,
	"status" text DEFAULT 'in_progress',
	"sale_status" text DEFAULT 'negotiation',
	"sale_performance" text,
	"lost_reason" text,
	"lost_notes" text,
	"notes" text,
	"chatwoot_conversation_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"activity_type" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company_name" text,
	"chatwoot_contact_id" text,
	"client_category" text DEFAULT 'final_consumer',
	"client_type" text DEFAULT 'person',
	"cnpj" text,
	"corporate_name" text,
	"cpf" text,
	"state_registration" text,
	"client_code" text,
	"email" text,
	"phone" text,
	"address" text,
	"address_number" text,
	"address_complement" text,
	"neighborhood" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"chatwoot_agent_id" text,
	"chatwoot_agent_name" text,
	"notes" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loss_reasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine_brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brand_id" integer NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"pipeline_id" integer NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_hidden" boolean DEFAULT false,
	"is_system" boolean DEFAULT false,
	"stage_type" text DEFAULT 'normal',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"has_fixed_stages" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_performance_reasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true,
	"is_system" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sale_performance_reasons_value_unique" UNIQUE("value")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"chatwoot_api_key" text,
	"chatwoot_url" text,
	"account_id" text,
	"last_sync_at" timestamp,
	"active_pipeline_id" integer
);
--> statement-breakpoint
CREATE TABLE "stage_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"stage_id" integer NOT NULL,
	"entered_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "client_machines" ADD CONSTRAINT "client_machines_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_models" ADD CONSTRAINT "machine_models_brand_id_machine_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."machine_brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_history" ADD CONSTRAINT "stage_history_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_history" ADD CONSTRAINT "stage_history_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;