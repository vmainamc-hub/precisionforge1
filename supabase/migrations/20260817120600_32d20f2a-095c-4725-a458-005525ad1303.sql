-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  deriv_connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile readable" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile writable" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- DERIV ACCOUNTS
CREATE TABLE public.deriv_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  loginid TEXT NOT NULL,
  token TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_virtual BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT false,
  balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, loginid)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deriv_accounts TO authenticated;
GRANT ALL ON public.deriv_accounts TO service_role;
ALTER TABLE public.deriv_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deriv accounts" ON public.deriv_accounts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER deriv_accounts_touch BEFORE UPDATE ON public.deriv_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- TRADES
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  deriv_account_id UUID REFERENCES public.deriv_accounts ON DELETE SET NULL,
  loginid TEXT,
  contract_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  stake NUMERIC NOT NULL DEFAULT 0,
  duration INTEGER,
  duration_unit TEXT,
  barrier TEXT,
  entry_price NUMERIC,
  exit_price NUMERIC,
  payout NUMERIC,
  profit NUMERIC,
  status TEXT NOT NULL DEFAULT 'open',
  is_virtual BOOLEAN NOT NULL DEFAULT true,
  auto_trade BOOLEAN NOT NULL DEFAULT false,
  signal_source TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own trades" ON public.trades FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins read trades" ON public.trades FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX trades_user_symbol_idx ON public.trades (user_id, symbol, purchased_at DESC);

-- PREFERENCES
CREATE TABLE public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  min_confidence NUMERIC NOT NULL DEFAULT 70,
  alert_sound BOOLEAN NOT NULL DEFAULT true,
  risk_profile TEXT NOT NULL DEFAULT 'balanced',
  max_daily_loss NUMERIC,
  max_stake NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own preferences" ON public.user_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER user_preferences_touch BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- AUTO TRADE SETTINGS
CREATE TABLE public.auto_trade_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  stake NUMERIC NOT NULL DEFAULT 1,
  duration_ticks INTEGER NOT NULL DEFAULT 5,
  min_confidence NUMERIC NOT NULL DEFAULT 75,
  max_daily_loss NUMERIC,
  max_consecutive_losses INTEGER NOT NULL DEFAULT 3,
  take_profit NUMERIC,
  stop_loss NUMERIC,
  demo_only BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_trade_settings TO authenticated;
GRANT ALL ON public.auto_trade_settings TO service_role;
ALTER TABLE public.auto_trade_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own auto trade settings" ON public.auto_trade_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER auto_trade_settings_touch BEFORE UPDATE ON public.auto_trade_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- APEX PER-MARKET LEARNING STATE (market-isolated by primary key)
CREATE TABLE public.apex_market_state (
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, symbol, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apex_market_state TO authenticated;
GRANT ALL ON public.apex_market_state TO service_role;
ALTER TABLE public.apex_market_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own apex state" ON public.apex_market_state FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER apex_market_state_touch BEFORE UPDATE ON public.apex_market_state FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RESOLVED VIRTUAL TRADES (the empirical evidence base)
CREATE TABLE public.apex_sim_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  contract TEXT NOT NULL,
  entry_condition TEXT NOT NULL DEFAULT 'immediate',
  entry_at TIMESTAMPTZ NOT NULL,
  entry_digit SMALLINT,
  entry_tick BIGINT,
  duration_ticks INTEGER NOT NULL DEFAULT 1,
  resolved_at TIMESTAMPTZ,
  resolution_digit SMALLINT,
  outcome TEXT,
  stake NUMERIC NOT NULL DEFAULT 1,
  payout NUMERIC,
  pnl NUMERIC,
  score NUMERIC,
  danger NUMERIC,
  stability NUMERIC,
  freshness NUMERIC,
  regime TEXT,
  threat_digit SMALLINT,
  lesson TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apex_sim_trades TO authenticated;
GRANT ALL ON public.apex_sim_trades TO service_role;
ALTER TABLE public.apex_sim_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own apex sim trades" ON public.apex_sim_trades FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX apex_sim_trades_lookup ON public.apex_sim_trades (user_id, symbol, contract, entry_at DESC);

-- SIGNALS
CREATE TABLE public.apex_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  contract TEXT NOT NULL,
  opportunity_score NUMERIC,
  confidence NUMERIC,
  edge NUMERIC,
  quality NUMERIC,
  stability NUMERIC,
  freshness NUMERIC,
  danger NUMERIC,
  simulator_validation NUMERIC,
  entry_condition TEXT,
  regime TEXT,
  threat_digit SMALLINT,
  reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apex_signals TO authenticated;
GRANT ALL ON public.apex_signals TO service_role;
ALTER TABLE public.apex_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own apex signals" ON public.apex_signals FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX apex_signals_lookup ON public.apex_signals (user_id, symbol, created_at DESC);

-- JOURNAL
CREATE TABLE public.apex_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  symbol TEXT,
  contract TEXT,
  kind TEXT NOT NULL DEFAULT 'note',
  body TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apex_journal TO authenticated;
GRANT ALL ON public.apex_journal TO service_role;
ALTER TABLE public.apex_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own apex journal" ON public.apex_journal FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
-- has_role stays EXECUTE-able by authenticated on purpose: RLS policies above
-- call it. It is SECURITY DEFINER with a pinned search_path, reads only
-- user_roles, returns a boolean and cannot be used to read or bypass any row.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- STAGE 3.5 / 4.1 — combination-level learning (market x contract x regime x entry condition)
CREATE TABLE public.sentinel_combo_stats (
  symbol TEXT NOT NULL,
  contract TEXT NOT NULL,
  regime TEXT NOT NULL,
  entry_condition TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  weighted_n NUMERIC NOT NULL DEFAULT 0,
  weighted_wins NUMERIC NOT NULL DEFAULT 0,
  expectancy NUMERIC NOT NULL DEFAULT 0,
  weighted_expectancy NUMERIC NOT NULL DEFAULT 0,
  net_pnl NUMERIC NOT NULL DEFAULT 0,
  max_drawdown NUMERIC NOT NULL DEFAULT 0,
  deterioration_pp NUMERIC NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_losing_streak INTEGER NOT NULL DEFAULT 0,
  decay_half_life_ms BIGINT NOT NULL DEFAULT 3600000,
  version INTEGER NOT NULL DEFAULT 1,
  last_outcome_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, contract, regime, entry_condition)
);
GRANT SELECT, INSERT, UPDATE ON public.sentinel_combo_stats TO authenticated;
GRANT ALL ON public.sentinel_combo_stats TO service_role;
ALTER TABLE public.sentinel_combo_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "combo stats readable" ON public.sentinel_combo_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "combo stats writable" ON public.sentinel_combo_stats FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "combo stats updatable" ON public.sentinel_combo_stats FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER sentinel_combo_stats_touch BEFORE UPDATE ON public.sentinel_combo_stats FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4.1 — resolved simulator trades, four-dimension tagged
CREATE TABLE public.sentinel_sim_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'client',
  symbol TEXT NOT NULL,
  contract TEXT NOT NULL,
  regime TEXT NOT NULL DEFAULT 'UNKNOWN',
  entry_condition TEXT NOT NULL DEFAULT 'IMMEDIATE',
  entry_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  entry_digit SMALLINT,
  resolution_digit SMALLINT,
  duration_ticks INTEGER NOT NULL DEFAULT 1,
  result TEXT NOT NULL,
  stake NUMERIC NOT NULL DEFAULT 1,
  pnl NUMERIC NOT NULL DEFAULT 0,
  direction_score NUMERIC,
  setup_score NUMERIC,
  danger NUMERIC,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sentinel_sim_trades TO authenticated;
GRANT ALL ON public.sentinel_sim_trades TO service_role;
ALTER TABLE public.sentinel_sim_trades ENABLE ROW LEVEL SECURITY;
-- Per-user simulation records: readable only by their owner (or shared rows
-- that carry no user at all), never by every signed-in account.
CREATE POLICY "own sim trades readable" ON public.sentinel_sim_trades FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "sim trades insertable" ON public.sentinel_sim_trades FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE INDEX sentinel_sim_trades_combo ON public.sentinel_sim_trades (symbol, contract, regime, entry_condition, entry_at DESC);

-- 4.1 — entry-condition test results per market x contract x regime
CREATE TABLE public.sentinel_entry_results (
  symbol TEXT NOT NULL,
  contract TEXT NOT NULL,
  regime TEXT NOT NULL,
  entry_condition TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  expectancy NUMERIC NOT NULL DEFAULT 0,
  oos_expectancy NUMERIC NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'UNTESTED',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, contract, regime, entry_condition)
);
GRANT SELECT, INSERT, UPDATE ON public.sentinel_entry_results TO authenticated;
GRANT ALL ON public.sentinel_entry_results TO service_role;
ALTER TABLE public.sentinel_entry_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entry results readable" ON public.sentinel_entry_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "entry results insertable" ON public.sentinel_entry_results FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "entry results updatable" ON public.sentinel_entry_results FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER sentinel_entry_results_touch BEFORE UPDATE ON public.sentinel_entry_results FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4.1 — market / psychology / danger / calibration / engine learning state
CREATE TABLE public.sentinel_learning_state (
  symbol TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, kind)
);
GRANT SELECT, INSERT, UPDATE ON public.sentinel_learning_state TO authenticated;
GRANT ALL ON public.sentinel_learning_state TO service_role;
ALTER TABLE public.sentinel_learning_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "learning state readable" ON public.sentinel_learning_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "learning state insertable" ON public.sentinel_learning_state FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "learning state updatable" ON public.sentinel_learning_state FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER sentinel_learning_state_touch BEFORE UPDATE ON public.sentinel_learning_state FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4.5 — versioned snapshots of learned state
CREATE TABLE public.sentinel_calibration_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  taken_on DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  version INTEGER NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (symbol, taken_on, version)
);
GRANT SELECT, INSERT ON public.sentinel_calibration_snapshots TO authenticated;
GRANT ALL ON public.sentinel_calibration_snapshots TO service_role;
ALTER TABLE public.sentinel_calibration_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshots readable" ON public.sentinel_calibration_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "snapshots insertable" ON public.sentinel_calibration_snapshots FOR INSERT TO authenticated WITH CHECK (true);

-- 4.1 / 4.3 — journal moved off localStorage
CREATE TABLE public.sentinel_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  mode TEXT NOT NULL DEFAULT 'MANUAL',
  symbol TEXT NOT NULL,
  name TEXT,
  contract TEXT NOT NULL,
  contract_label TEXT,
  opportunity NUMERIC,
  confidence NUMERIC,
  edge_pct NUMERIC,
  danger NUMERIC,
  quality NUMERIC,
  entry_digit_index INTEGER,
  outcome TEXT NOT NULL DEFAULT 'PENDING',
  resolved_digit SMALLINT,
  note TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sentinel_journal TO authenticated;
GRANT ALL ON public.sentinel_journal TO service_role;
ALTER TABLE public.sentinel_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sentinel journal" ON public.sentinel_journal FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER sentinel_journal_touch BEFORE UPDATE ON public.sentinel_journal FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();