-- ROLLBACK for 0224_mfa_aal2_rls.sql
-- After running this, re-deploy the app commit before 0224 (its admin
-- impersonation no longer writes impersonation_sessions).

alter role authenticator reset pgrst.db_pre_request;
notify pgrst, 'reload config';
drop function if exists public.mfa_pre_request();

drop policy if exists mfa_aal2_required on storage.objects;

do $$
declare
  t text;
  user_tables text[] := array[
    'profiles', 'follows', 'subscriptions', 'providers', 'signals', 'simulated_positions',
    'notifications', 'kyc_submissions', 'wallet_requests', 'wallet_transactions',
    'follower_invites', 'lead_trader_profiles', 'lead_trader_applications',
    'lead_trader_announcements', 'lead_trader_follower_removals', 'lead_trader_payout_requests',
    'profit_share_ledger', 'trader_posts', 'admin_audit_log', 'trade_audit_log',
    'trade_integrity_reports',
    '_bak_20260930_lead_trader_announcements', '_bak_20260930_lead_trader_profiles',
    '_bak_20261001_signals', '_bak_20261001_simulated_positions', '_bak_20261001b_profiles_balance',
    '_bak_20261001b_providers_profit', '_bak_20261001b_signals', '_bak_20261001b_simulated_positions',
    '_bak_20261001c_signals_no_lot'
  ];
begin
  foreach t in array user_tables loop
    execute format('drop policy if exists mfa_aal2_required on public.%I', t);
  end loop;
end $$;

drop function if exists public.session_mfa_ok();
drop table if exists public.impersonation_sessions;
