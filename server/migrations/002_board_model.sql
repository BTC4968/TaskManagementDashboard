CREATE TABLE IF NOT EXISTS boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 120),
  description text,
  background text NOT NULL DEFAULT 'linear-gradient(135deg, #0c66e4 0%, #5e4db2 100%)',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS task_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 120),
  status text CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
  position numeric NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'system'
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS board_id uuid REFERENCES boards(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS list_id uuid REFERENCES task_lists(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position numeric NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cover_color text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_labels (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(trim(text)) BETWEEN 1 AND 240),
  checked boolean NOT NULL DEFAULT false,
  position numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 2000),
  author text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

WITH default_board AS (
  INSERT INTO boards (title, description, updated_by)
  SELECT 'Project Board', 'Default collaborative task board', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM boards)
  RETURNING id
),
board_ref AS (
  SELECT id FROM default_board
  UNION ALL
  SELECT id FROM (
    SELECT id FROM boards ORDER BY created_at ASC LIMIT 1
  ) existing_board
),
seed_lists AS (
  INSERT INTO task_lists (board_id, title, status, position, updated_by)
  SELECT board_ref.id, list_data.title, list_data.status, list_data.position, 'system'
  FROM board_ref
  CROSS JOIN (
    VALUES
      ('To Do', 'TODO', 1024),
      ('In Progress', 'IN_PROGRESS', 2048),
      ('Done', 'DONE', 3072)
  ) AS list_data(title, status, position)
  WHERE NOT EXISTS (
    SELECT 1 FROM task_lists WHERE task_lists.board_id = board_ref.id
  )
  RETURNING id
)
UPDATE tasks
SET
  board_id = (SELECT id FROM board_ref LIMIT 1),
  list_id = (
    SELECT id
    FROM task_lists
    WHERE task_lists.board_id = (SELECT id FROM board_ref LIMIT 1)
      AND task_lists.status = tasks.status
    LIMIT 1
  ),
  position = ranked.position
FROM (
  SELECT id, row_number() OVER (PARTITION BY status ORDER BY updated_at DESC, id ASC) * 1024 AS position
  FROM tasks
) ranked
WHERE tasks.id = ranked.id
  AND tasks.board_id IS NULL;

ALTER TABLE tasks ALTER COLUMN board_id SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN list_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_lists_board_position ON task_lists (board_id, archived, position);
CREATE INDEX IF NOT EXISTS idx_tasks_board_list_position ON tasks (board_id, list_id, archived, position);
CREATE INDEX IF NOT EXISTS idx_labels_board ON labels (board_id);
CREATE INDEX IF NOT EXISTS idx_checklist_task_position ON checklist_items (task_id, position);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_created ON task_comments (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_activity_board_created ON task_activity (board_id, created_at DESC);
