-- KucingKu Sehat - Initial Schema
-- Run this in your Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CATS - each user can have multiple cat profiles
-- ============================================================
CREATE TABLE cats (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  breed       TEXT,
  birth_date  DATE,
  gender      TEXT CHECK (gender IN ('male', 'female', 'unknown')) DEFAULT 'unknown',
  weight_kg   NUMERIC(4,2),
  photo_url   TEXT,
  notes       TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cats_user ON cats(user_id);

-- ============================================================
-- LAB_RESULTS - one row per lab visit / uploaded document
-- ============================================================
CREATE TABLE lab_results (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cat_id         UUID NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_date      DATE NOT NULL,
  lab_name       TEXT,
  document_url   TEXT,
  ai_raw_output  TEXT,
  status         TEXT CHECK (status IN ('processing', 'extracted', 'confirmed', 'error'))
                 DEFAULT 'processing',
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lab_results_cat  ON lab_results(cat_id);
CREATE INDEX idx_lab_results_date ON lab_results(cat_id, test_date DESC);

-- ============================================================
-- LAB_VALUES - individual extracted values from each lab result
-- ============================================================
CREATE TABLE lab_values (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lab_result_id   UUID NOT NULL REFERENCES lab_results(id) ON DELETE CASCADE,
  parameter_name  TEXT NOT NULL,
  parameter_label TEXT,
  value           NUMERIC NOT NULL,
  unit            TEXT NOT NULL,
  ref_min         NUMERIC,
  ref_max         NUMERIC,
  is_abnormal     BOOLEAN DEFAULT FALSE,
  flag            TEXT CHECK (flag IN ('normal', 'low', 'high', 'critical_low', 'critical_high'))
                  DEFAULT 'normal',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lab_values_result ON lab_values(lab_result_id);
CREATE INDEX idx_lab_values_trend  ON lab_values(parameter_name, lab_result_id);

-- ============================================================
-- PURCHASE_LOG - food, vitamins, supplements tracking
-- ============================================================
CREATE TABLE purchase_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cat_id        UUID NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category      TEXT CHECK (category IN ('food', 'vitamin', 'medicine', 'supplement', 'other'))
                NOT NULL,
  product_name  TEXT NOT NULL,
  brand         TEXT,
  quantity      TEXT,
  price_idr     INTEGER,
  purchase_date DATE DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_purchase_log_cat ON purchase_log(cat_id, purchase_date DESC);

-- ============================================================
-- CHAT_SESSIONS - persisted chat history per cat
-- ============================================================
CREATE TABLE chat_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cat_id      UUID REFERENCES cats(id) ON DELETE SET NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT,
  messages    JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC);
CREATE INDEX idx_chat_sessions_cat  ON chat_sessions(cat_id);

-- ============================================================
-- SUBSCRIPTIONS - track active subscriptions
-- ============================================================
CREATE TABLE subscriptions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan          TEXT CHECK (plan IN ('free', 'basic', 'premium')) DEFAULT 'free',
  status        TEXT CHECK (status IN ('active', 'expired', 'cancelled')) DEFAULT 'active',
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  payment_ref   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE cats ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users manage own cats"
  ON cats FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own lab_results"
  ON lab_results FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own lab_values"
  ON lab_values FOR ALL
  USING (lab_result_id IN (SELECT id FROM lab_results WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own purchases"
  ON purchase_log FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own chats"
  ON chat_sessions FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own subscriptions"
  ON subscriptions FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET for lab documents and cat photos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('cat-files', 'cat-files', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Users upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cat-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cat-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'cat-files' AND auth.uid()::text = (storage.foldername(name))[1]);
