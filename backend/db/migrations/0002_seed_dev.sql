-- Idempotent development seed: default Organization + initial Workspaces.
INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'EveryAI Studio', 'everyai-studio')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO workspaces (id, org_id, name)
VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Explainers'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Shorts daily'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Podcast clips')
ON CONFLICT (id) DO NOTHING;
