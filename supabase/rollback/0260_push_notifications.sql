-- Rollback of 0260: Web Push.
begin;

do $$ begin perform cron.unschedule('push-dispatch'); exception when others then null; end $$;
drop trigger if exists trg_notifications_push_outbox on public.notifications;
drop function if exists public.notifications_push_outbox();
drop function if exists public.fire_push_dispatch();
drop table if exists public.push_outbox;
drop table if exists public.push_subscriptions;

commit;
