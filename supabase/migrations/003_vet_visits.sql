-- KucingKu Sehat - Vet Visits
-- Run after 002_admin_schema.sql

-- ============================================================
-- VET_VISITS
-- ============================================================
CREATE TABLE vet_visits (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cat_id      UUID NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  clinic_name TEXT,
  vet_name    TEXT,
  reason      TEXT,
  diagnosis   TEXT,
  cost_idr    INTEGER,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vet_visits_cat  ON vet_visits(cat_id, visit_date DESC);
CREATE INDEX idx_vet_visits_user ON vet_visits(user_id);

ALTER TABLE vet_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own vet_visits"
  ON vet_visits FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Link lab_results to a vet visit (nullable — not every lab
-- comes with a logged visit, and vice versa)
-- ============================================================
ALTER TABLE lab_results ADD COLUMN vet_visit_id UUID REFERENCES vet_visits(id) ON DELETE SET NULL;
CREATE INDEX idx_lab_results_vet_visit ON lab_results(vet_visit_id);
