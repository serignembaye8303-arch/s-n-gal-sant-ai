-- 1. Table
CREATE TABLE public.ai_diagnostics_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  facility text NOT NULL DEFAULT '',
  model text NOT NULL,
  latency_ms integer NOT NULL CHECK (latency_ms >= 0),
  confidence_score numeric(5,4) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  validated_by_specialist boolean,
  specialist_agrees boolean,
  symptoms_summary text,
  suggested_diagnosis text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_logs_facility_created ON public.ai_diagnostics_logs (facility, created_at DESC);
CREATE INDEX idx_ai_logs_created ON public.ai_diagnostics_logs (created_at DESC);

-- 2. RLS
ALTER TABLE public.ai_diagnostics_logs ENABLE ROW LEVEL SECURITY;

-- Admin: full read
CREATE POLICY "Admins view all ai logs"
ON public.ai_diagnostics_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Specialist: read only their facility's logs
CREATE POLICY "Specialists view own facility ai logs"
ON public.ai_diagnostics_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'specialist')
  AND facility = (SELECT p.facility FROM public.profiles p WHERE p.id = auth.uid())
);

-- Agent: insert their own logs
CREATE POLICY "Agents insert own ai logs"
ON public.ai_diagnostics_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = agent_id);

-- Agent: read their own logs
CREATE POLICY "Agents view own ai logs"
ON public.ai_diagnostics_logs
FOR SELECT
TO authenticated
USING (auth.uid() = agent_id);

-- 3. Realtime
ALTER TABLE public.ai_diagnostics_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_diagnostics_logs;