ALTER TABLE public.sentinel_sim_trades
  DROP CONSTRAINT IF EXISTS sentinel_sim_trades_client_key_key;

DROP INDEX IF EXISTS public.sentinel_sim_trades_user_client_key;

CREATE UNIQUE INDEX IF NOT EXISTS sentinel_sim_trades_user_client_key
  ON public.sentinel_sim_trades (user_id, client_key);

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

ALTER TABLE public.sentinel_sim_trades ALTER COLUMN user_id SET NOT NULL;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sentinel_sim_trades' LOOP
    EXECUTE format('DROP POLICY %I ON public.sentinel_sim_trades', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "own sim trades select" ON public.sentinel_sim_trades
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own sim trades insert" ON public.sentinel_sim_trades
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sim trades update" ON public.sentinel_sim_trades
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sim trades delete" ON public.sentinel_sim_trades
  FOR DELETE TO authenticated USING (auth.uid() = user_id);