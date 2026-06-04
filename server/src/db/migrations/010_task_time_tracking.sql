ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimate_minutes integer CHECK (estimate_minutes IS NULL OR estimate_minutes >= 0);

CREATE TABLE IF NOT EXISTS task_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  minutes integer NOT NULL CHECK (minutes > 0),
  comment text,
  author text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_time_logs_task_id ON task_time_logs (task_id, created_at DESC);
