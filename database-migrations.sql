-- Criação da tabela de funis (pipelines)
CREATE TABLE IF NOT EXISTS pipelines (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  has_fixed_stages BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Inserção de funis padrão
INSERT INTO pipelines (name, description, is_default, has_fixed_stages, is_active)
VALUES 
  ('Comercial', 'Funil para área comercial com estágios fixos de vendas realizadas e vendas perdidas', TRUE, TRUE, TRUE),
  ('Compras e Logística', 'Funil para área de compras e logística sem estágios fixos', FALSE, FALSE, TRUE);

-- Adicionar coluna de pipeline_id na tabela de estágios
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS pipeline_id INTEGER NOT NULL DEFAULT 1;

-- Atualizar a foreign key para a tabela de pipelines
ALTER TABLE pipeline_stages ADD CONSTRAINT fk_pipeline_id 
  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE;

-- Adicionar coluna de pipeline_id na tabela de deals
ALTER TABLE deals ADD COLUMN IF NOT EXISTS pipeline_id INTEGER NOT NULL DEFAULT 1;

-- Atualizar a foreign key para a tabela de pipelines
ALTER TABLE deals ADD CONSTRAINT fk_deal_pipeline_id 
  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE;

-- Adicionar coluna de active_pipeline_id na tabela de settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS active_pipeline_id INTEGER;

-- Atualizar todos os estágios existentes para o funil 1 (Comercial)
UPDATE pipeline_stages SET pipeline_id = 1 WHERE pipeline_id IS NULL;

-- Atualizar todos os deals existentes para o funil 1 (Comercial)
UPDATE deals SET pipeline_id = 1 WHERE pipeline_id IS NULL;

-- Atualizar as configurações para usar o funil 1 como padrão
UPDATE settings SET active_pipeline_id = 1 WHERE active_pipeline_id IS NULL;

-- Adicionar coluna de ordenação na tabela de deals
ALTER TABLE deals ADD COLUMN "order" integer DEFAULT 0;