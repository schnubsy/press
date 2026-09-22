-- ROLLBACK for 20260922_perth_rls_gate.sql — restore the pre-Phase-2 permissive policies.
-- Author: Claude Opus 4.8 for Mark Gubb, 2026-09-22.  NOT a forward migration — apply ONLY to undo.
--
-- ROLLBACK ORDER: REVERT THE PAGE FIRST, THEN apply this file.
--   1. git -C ~/Documents/VSCode/press revert --no-edit <perth.html publish commit>  &&  git ... push
--      (perth.html goes back to sending the bare anon key)
--   2. apply this file (RLS returns to the permissive sync_id-IS-NULL union)
-- Restoring the permissive policy while the JWT page is still live is harmless (the null-scoped branch
-- admits the authenticated role too), but reverting the page first keeps page and policy in lockstep.
--
-- Undoes all three steps of the UP: drops the authenticated-only perth policy and restores the two
-- shared policies to their EXACT pre-Phase-2 definitions, verified live from pg_policies on 2026-09-22:
--   press_tasks_scoped on public.press_tasks  — FOR ALL TO anon, authenticated
--   press_state_scoped on public.press_state  — FOR ALL TO anon, authenticated
--   USING and WITH CHECK both:
--     ((sync_id IS NULL) OR (sync_id = NULLIF(((current_setting('request.headers'::text, true))::json ->> 'x-plan-id'::text), ''::text)))
-- ALTER POLICY restores the expressions; roles (anon, authenticated) and command (ALL) never changed,
-- so this returns each shared policy to its original definition byte-for-byte.

-- 1) Remove the authenticated-only perth policy added by the UP.
drop policy if exists press_tasks_perth on public.press_tasks;

-- 2) Restore the permissive shared policies (byte-for-byte).
alter policy press_tasks_scoped on public.press_tasks
  using (
    ((sync_id IS NULL) OR (sync_id = NULLIF(((current_setting('request.headers'::text, true))::json ->> 'x-plan-id'::text), ''::text)))
  )
  with check (
    ((sync_id IS NULL) OR (sync_id = NULLIF(((current_setting('request.headers'::text, true))::json ->> 'x-plan-id'::text), ''::text)))
  );

alter policy press_state_scoped on public.press_state
  using (
    ((sync_id IS NULL) OR (sync_id = NULLIF(((current_setting('request.headers'::text, true))::json ->> 'x-plan-id'::text), ''::text)))
  )
  with check (
    ((sync_id IS NULL) OR (sync_id = NULLIF(((current_setting('request.headers'::text, true))::json ->> 'x-plan-id'::text), ''::text)))
  );
