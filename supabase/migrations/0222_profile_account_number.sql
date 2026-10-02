-- Short, random, immutable 8-digit account number per user (display/identification only;
-- never used for auth or permissions -- profiles.id remains the identity).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_number bigint;

CREATE OR REPLACE FUNCTION public.generate_account_number()
RETURNS bigint
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_num bigint;
BEGIN
  LOOP
    v_num := 10000000 + floor(random() * 90000000)::bigint;  -- 10000000..99999999
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE account_number = v_num);
  END LOOP;
  RETURN v_num;
END;
$$;

CREATE OR REPLACE FUNCTION public.profiles_assign_account_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.account_number IS NULL THEN
    NEW.account_number := public.generate_account_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_assign_account_number ON public.profiles;
CREATE TRIGGER trg_profiles_assign_account_number
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_assign_account_number();

-- Backfill existing users (row by row so each pick sees the previous ones).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE account_number IS NULL LOOP
    UPDATE public.profiles SET account_number = public.generate_account_number() WHERE id = r.id;
  END LOOP;
END;
$$;

ALTER TABLE public.profiles ALTER COLUMN account_number SET NOT NULL;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_number_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_number_key UNIQUE (account_number);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_number_range;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_number_range
  CHECK (account_number BETWEEN 10000000 AND 99999999);

-- Immutable once set (created after the backfill so it doesn't block it).
CREATE OR REPLACE FUNCTION public.profiles_block_account_number_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.account_number IS DISTINCT FROM OLD.account_number THEN
    RAISE EXCEPTION 'account_number is immutable' USING errcode = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_block_account_number_update ON public.profiles;
CREATE TRIGGER trg_profiles_block_account_number_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_block_account_number_update();
