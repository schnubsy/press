# press — Arc inbox

_Items land here when flagged for arc review. Resolved items move to docs/history.md._

## 2026-09-18 — arc/two-space-marquee — ONE ITEM REMAINING (deferred by decision)

The two-space arc is built, verified, and published. **One action is deliberately held** until
Mark confirms he has enrolled the private-wing passkey AND Card Scout shows deals through the vault:
the **`press_deals` CLEANUP migration** (Amendment B). The additive phase is live; the open policies
are still in place ON PURPOSE so the live Card Scout page keeps rendering deals through enrolment.
The 🔴 open-policy finding stays OPEN until this runs.

**To finish (one command via the Supabase MCP `apply_migration`, name `20260918_press_deals_gate_cleanup`,
project `eepjhpyziczrxvirczio`):**

```sql
drop policy if exists press_deals_anon_all on public.press_deals;
drop policy if exists press_deals_auth_all on public.press_deals;
revoke delete on table public.press_deals from anon, authenticated;
alter table public.press_deals alter column sync_id set not null;
```

Then run the **negative anon probes** and append them to `docs/evidence/two-space-slice-4-deals-rls.txt`:
no `x-plan-id` header ⇒ 0 rows; wrong header ⇒ 0 rows; correct header ⇒ own rows only; anon DELETE ⇒
rejected. Re-check `get_advisors(security)` clean. Pre-image + rollback: `docs/evidence/two-space-slice-4-preimage.txt`.

Only after this runs is the arc fully closed (move this to `docs/history.md`).
