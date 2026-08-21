ALTER TABLE public.sentinel_sim_trades
  DROP CONSTRAINT IF EXISTS sentinel_sim_trades_client_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS sentinel_sim_trades_user_client_key
  ON public.sentinel_sim_trades (user_id, client_key)
  WHERE client_key IS NOT NULL;