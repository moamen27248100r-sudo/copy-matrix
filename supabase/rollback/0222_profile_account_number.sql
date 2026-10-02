DROP TRIGGER IF EXISTS trg_profiles_block_account_number_update ON public.profiles;
DROP TRIGGER IF EXISTS trg_profiles_assign_account_number ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_block_account_number_update();
DROP FUNCTION IF EXISTS public.profiles_assign_account_number();
DROP FUNCTION IF EXISTS public.generate_account_number();
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_number_range;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_number_key;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS account_number;
