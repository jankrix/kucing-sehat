-- KucingKu Sehat - Admin Schema
-- Run this in your Supabase SQL Editor AFTER 001_initial_schema.sql

-- ============================================================
-- VOUCHERS
-- ============================================================
CREATE TABLE vouchers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT UNIQUE NOT NULL,
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
  max_uses        INTEGER DEFAULT NULL,   -- NULL = unlimited
  used_count      INTEGER DEFAULT 0,
  expires_at      TIMESTAMPTZ DEFAULT NULL, -- NULL = no expiry
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vouchers_code ON vouchers(code) WHERE is_active = TRUE;

-- ============================================================
-- APP CONFIG (pricing, feature flags)
-- ============================================================
CREATE TABLE app_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Default pricing config
INSERT INTO app_config (key, value) VALUES
  ('pricing', '{
    "basic_idr": 35000,
    "premium_idr": 49000,
    "testing_mode": false,
    "min_price_idr": 35000
  }');

-- ============================================================
-- No RLS on these tables — admin only via service key
-- (never exposed to frontend directly)
-- ============================================================
