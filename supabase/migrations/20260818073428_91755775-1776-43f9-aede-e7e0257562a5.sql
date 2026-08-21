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