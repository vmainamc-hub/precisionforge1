CREATE TABLE IF NOT EXISTS public.sentinel_operator_feedback (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('TRADE','OBSERVATION')),
  item_id text NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sentinel_operator_feedback TO authenticated;
GRANT ALL ON public.sentinel_operator_feedback TO service_role;

ALTER TABLE public.sentinel_operator_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own feedback select" ON public.sentinel_operator_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own feedback insert" ON public.sentinel_operator_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own feedback update" ON public.sentinel_operator_feedback
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own feedback delete" ON public.sentinel_operator_feedback
  FOR DELETE TO authenticated USING (auth.uid() = user_id);