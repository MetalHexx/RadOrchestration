CREATE EXTENSION IF NOT EXISTS vector;

-- Cross-project knowledge store
CREATE TABLE project_knowledge (
  id            SERIAL PRIMARY KEY,
  project_name  TEXT NOT NULL,
  category      TEXT NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  source_doc    TEXT,
  embedding     vector(1024),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pk_embedding ON project_knowledge
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_pk_project ON project_knowledge (project_name);
CREATE INDEX idx_pk_category ON project_knowledge (category);

-- Per-project context store
CREATE TABLE context_chunks (
  id            SERIAL PRIMARY KEY,
  project_name  TEXT NOT NULL,
  phase         INTEGER,
  doc_path      TEXT NOT NULL,
  section_title TEXT NOT NULL,
  content       TEXT NOT NULL,
  doc_type      TEXT NOT NULL,
  embedding     vector(1024),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cc_embedding ON context_chunks
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_cc_project ON context_chunks (project_name);
CREATE INDEX idx_cc_doc_type ON context_chunks (doc_type);
CREATE INDEX idx_cc_phase ON context_chunks (project_name, phase);
