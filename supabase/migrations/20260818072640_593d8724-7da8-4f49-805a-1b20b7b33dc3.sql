DROP INDEX IF EXISTS public.sentinel_sim_trades_user_client_key;

CREATE UNIQUE INDEX IF NOT EXISTS sentinel_sim_trades_user_client_key
  ON public.sentinel_sim_trades (user_id, client_key);