-- Cat persistent memory: stores AI-extracted health notes per cat
ALTER TABLE cats ADD COLUMN IF NOT EXISTS memory_notes TEXT;

-- History log for rollback (in case extraction produces bad output)
CREATE TABLE IF NOT EXISTS cat_memory_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cat_id      UUID NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  session_id  UUID,
  memory_notes TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS: owners can read their own history, but not write (backend-only via service key)
ALTER TABLE cat_memory_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cat memory history"
  ON cat_memory_history FOR SELECT
  USING (
    cat_id IN (
      SELECT id FROM cats WHERE user_id = auth.uid()
    )
  );
