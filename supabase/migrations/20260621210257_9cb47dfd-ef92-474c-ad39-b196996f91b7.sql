CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  permission text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins write permissions" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default matrix
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  -- admin : tout
  ('admin', 'users.manage', true),
  ('admin', 'facilities.manage', true),
  ('admin', 'permissions.manage', true),
  ('admin', 'patients.create', true),
  ('admin', 'patients.view', true),
  ('admin', 'patients.update', true),
  ('admin', 'records.view', true),
  ('admin', 'records.update', true),
  ('admin', 'diagnostics.create', true),
  ('admin', 'diagnostics.validate', true),
  ('admin', 'reports.view', true),
  -- specialiste
  ('specialiste', 'users.manage', false),
  ('specialiste', 'facilities.manage', false),
  ('specialiste', 'permissions.manage', false),
  ('specialiste', 'patients.create', false),
  ('specialiste', 'patients.view', true),
  ('specialiste', 'patients.update', false),
  ('specialiste', 'records.view', true),
  ('specialiste', 'records.update', true),
  ('specialiste', 'diagnostics.create', false),
  ('specialiste', 'diagnostics.validate', true),
  ('specialiste', 'reports.view', true),
  -- agent
  ('agent', 'users.manage', false),
  ('agent', 'facilities.manage', false),
  ('agent', 'permissions.manage', false),
  ('agent', 'patients.create', true),
  ('agent', 'patients.view', true),
  ('agent', 'patients.update', true),
  ('agent', 'records.view', true),
  ('agent', 'records.update', false),
  ('agent', 'diagnostics.create', true),
  ('agent', 'diagnostics.validate', false),
  ('agent', 'reports.view', false)
ON CONFLICT (role, permission) DO NOTHING;