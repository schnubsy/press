-- docs/evidence/monitor-view-timeout-view-before.sql — ROLLBACK for arc monitor-view-timeout slice 2.
-- The LIVE definition of public.press_agent_monitor_public, captured read-only on 2026-11-15 with
-- pg_get_viewdef('public.press_agent_monitor_public', true) — md5 of the definition body (everything after the
-- "as" line below, without the trailing newline) = 7b0ddf18fea7ae19e0eb8508e7507012 (13,719 bytes), verified against
-- the live md5. (The live view was string-patched by db/20261013_agent_monitor_quiet_alerts.sql, so no single db/ file
-- held it before this arc.) Re-applying it keeps the existing grants (CREATE OR REPLACE).
create or replace view public.press_agent_monitor_public as
 WITH e AS (
         SELECT press_agent_expect.id,
            press_agent_expect.app_label,
            press_agent_expect.label,
            press_agent_expect.what,
            press_agent_expect.kind,
            press_agent_expect.enabled,
            press_agent_expect.source,
            press_agent_expect.run_app,
            press_agent_expect.run_agent,
            press_agent_expect.cron_job,
            press_agent_expect.dispatch_only,
            press_agent_expect.output_page,
            press_agent_expect.sched,
            press_agent_expect.grace_minutes,
            press_agent_expect.fix_hint,
            press_agent_expect.fix_links,
            press_agent_expect.retry_action,
            press_agent_expect.sort,
            press_agent_expect.registered_at,
            press_agent_expect.idle_is_work
           FROM press_agent_expect
        ), runs AS (
         SELECT e.id,
            x.outcome,
            x.finished_at,
            x.started_at,
            x.cost_usd,
            x.note,
            x.input_hash,
            e.idle_is_work
           FROM e
             JOIN press_agent_runs x ON x.app = e.run_app AND x.agent = e.run_agent
          WHERE (e.source = ANY (ARRAY['runs-work'::text, 'runs-alive'::text, 'runs-event'::text])) AND x.outcome <> 'dead'::text
        UNION ALL
         SELECT e.id,
            x.outcome,
            x.finished_at,
            x.started_at,
            x.cost_usd,
            x.note,
            x.input_hash,
            e.idle_is_work
           FROM e
             JOIN press_agent_runs x ON x.app = 'task'::text AND x.agent = e.id
          WHERE e.source = 'checkin'::text
        ), rf AS (
         SELECT runs.id,
            max(runs.finished_at) FILTER (WHERE (runs.outcome = ANY (ARRAY['ok'::text, 'warn'::text])) OR runs.idle_is_work AND runs.outcome = 'skipped'::text AND runs.input_hash = 'h-811c9dc5'::text) AS work_at,
            max(runs.finished_at) AS alive_at,
            max(runs.finished_at) FILTER (WHERE runs.outcome = 'error'::text) AS fail_at,
            count(*) AS n_runs
           FROM runs
          GROUP BY runs.id
        ), cf AS (
         SELECT e.id,
            max(d.end_time) FILTER (WHERE d.status = 'succeeded'::text) AS work_at,
            max(d.start_time) AS alive_at,
            max(d.start_time) FILTER (WHERE d.status = 'failed'::text) AS fail_at,
            count(d.runid) AS n_runs,
            bool_or(j.active) AS active,
            (array_agg(d.return_message ORDER BY d.start_time DESC) FILTER (WHERE d.status = 'succeeded'::text))[1] AS last_msg
           FROM e
             JOIN cron.job j ON j.jobname = e.cron_job
             LEFT JOIN cron.job_run_details d ON d.jobid = j.jobid AND d.start_time > (now() - '40 days'::interval)
          WHERE e.source = 'cron'::text
          GROUP BY e.id
        ), costs AS (
         SELECT r.id,
            sum(COALESCE(r.cost_usd, 0::numeric)) FILTER (WHERE (r.finished_at AT TIME ZONE 'America/Chicago'::text)::date >= date_trunc('month'::text, (now() AT TIME ZONE 'America/Chicago'::text))::date) AS mtd,
            sum(COALESCE(r.cost_usd, 0::numeric)) FILTER (WHERE (r.finished_at AT TIME ZONE 'America/Chicago'::text)::date >= ((now() AT TIME ZONE 'America/Chicago'::text)::date - 7) AND (r.finished_at AT TIME ZONE 'America/Chicago'::text)::date <= ((now() AT TIME ZONE 'America/Chicago'::text)::date - 1)) / 7.0 AS avg7
           FROM runs r
          WHERE r.finished_at > (now() - '40 days'::interval)
          GROUP BY r.id
        ), f AS (
         SELECT e.id,
            e.app_label,
            e.label,
            e.what,
            e.kind,
            e.enabled,
            e.source,
            e.run_app,
            e.run_agent,
            e.cron_job,
            e.dispatch_only,
            e.output_page,
            e.sched,
            e.grace_minutes,
            e.fix_hint,
            e.fix_links,
            e.retry_action,
            e.sort,
            e.registered_at,
            COALESCE(rf.work_at, cf.work_at) AS work_at,
            COALESCE(rf.alive_at, cf.alive_at) AS alive_at,
            COALESCE(rf.fail_at, cf.fail_at) AS fail_at,
            COALESCE(rf.n_runs, cf.n_runs, 0::bigint) AS n_runs,
            COALESCE(cf.active, true) AS job_active,
            cf.last_msg,
            e.sched ? 'every'::text AS is_interval,
            e.sched IS NOT NULL AND NOT e.sched ? 'every'::text AS is_calendar
           FROM e
             LEFT JOIN rf ON rf.id = e.id
             LEFT JOIN cf ON cf.id = e.id
        ), g AS (
         SELECT f.id,
            f.app_label,
            f.label,
            f.what,
            f.kind,
            f.enabled,
            f.source,
            f.run_app,
            f.run_agent,
            f.cron_job,
            f.dispatch_only,
            f.output_page,
            f.sched,
            f.grace_minutes,
            f.fix_hint,
            f.fix_links,
            f.retry_action,
            f.sort,
            f.registered_at,
            f.work_at,
            f.alive_at,
            f.fail_at,
            f.n_runs,
            f.job_active,
            f.last_msg,
            f.is_interval,
            f.is_calendar,
                CASE
                    WHEN f.source = 'runs-alive'::text THEN f.alive_at
                    ELSE f.work_at
                END AS basis_at,
                CASE
                    WHEN f.is_calendar THEN press_agent_last_due(f.sched, now() - make_interval(mins => f.grace_minutes))
                    ELSE NULL::timestamp with time zone
                END AS eff_due,
                CASE
                    WHEN f.is_interval THEN make_interval(mins => ((f.sched ->> 'every'::text)::integer) + f.grace_minutes)
                    ELSE NULL::interval
                END AS lim
           FROM f
        ), s AS (
         SELECT g.id,
            g.app_label,
            g.label,
            g.what,
            g.kind,
            g.enabled,
            g.source,
            g.run_app,
            g.run_agent,
            g.cron_job,
            g.dispatch_only,
            g.output_page,
            g.sched,
            g.grace_minutes,
            g.fix_hint,
            g.fix_links,
            g.retry_action,
            g.sort,
            g.registered_at,
            g.work_at,
            g.alive_at,
            g.fail_at,
            g.n_runs,
            g.job_active,
            g.last_msg,
            g.is_interval,
            g.is_calendar,
            g.basis_at,
            g.eff_due,
            g.lim,
            g.fail_at IS NOT NULL AND g.fail_at > COALESCE(g.basis_at, '-infinity'::timestamp with time zone) AS fail_after,
                CASE
                    WHEN NOT g.enabled OR NOT g.job_active THEN 'off'::text
                    WHEN g.source = 'none'::text THEN 'no-data'::text
                    WHEN g.sched IS NULL THEN
                    CASE
                        WHEN g.n_runs = 0 THEN 'no-data'::text
                        WHEN g.fail_at IS NOT NULL AND g.fail_at > COALESCE(g.work_at, '-infinity'::timestamp with time zone) AND g.fail_at > (now() - '7 days'::interval) THEN 'failed'::text
                        ELSE 'healthy'::text
                    END
                    WHEN g.is_interval THEN
                    CASE
                        WHEN g.basis_at IS NULL THEN
                        CASE
                            WHEN (now() - g.registered_at) > g.lim THEN 'late'::text
                            ELSE 'no-data'::text
                        END
                        WHEN g.fail_at IS NOT NULL AND g.fail_at > g.basis_at THEN 'failed'::text
                        WHEN (now() - g.basis_at) > (g.lim * 4::double precision) THEN 'failed'::text
                        WHEN (now() - g.basis_at) > g.lim THEN 'late'::text
                        ELSE 'healthy'::text
                    END
                    ELSE
                    CASE
                        WHEN g.eff_due IS NULL OR g.eff_due < g.registered_at THEN
                        CASE
                            WHEN g.basis_at IS NULL THEN 'no-data'::text
                            WHEN g.fail_at IS NOT NULL AND g.fail_at > g.basis_at THEN 'failed'::text
                            ELSE 'healthy'::text
                        END
                        WHEN g.fail_at IS NOT NULL AND g.fail_at > COALESCE(g.basis_at, '-infinity'::timestamp with time zone) AND g.fail_at >= (g.eff_due - '00:30:00'::interval) THEN 'failed'::text
                        WHEN g.basis_at >= (g.eff_due - '00:30:00'::interval) THEN 'healthy'::text
                        ELSE 'late'::text
                    END
                END AS status
           FROM g
        )
 SELECT s.id,
    s.app_label,
    s.label,
    s.what,
    s.kind,
    s.enabled,
    s.sched,
    s.grace_minutes,
    s.sort,
    s.status,
        CASE s.status
            WHEN 'off'::text THEN 'Switched off'::text
            WHEN 'no-data'::text THEN
            CASE
                WHEN s.source = 'none'::text THEN 'Not instrumented yet — nothing records its runs'::text
                WHEN s.sched IS NULL THEN 'On demand · no calls logged yet'::text
                ELSE 'Waiting for its first run'::text
            END
            WHEN 'failed'::text THEN
            CASE
                WHEN s.basis_at IS NULL THEN 'Has never run'::text
                WHEN s.fail_at IS NOT NULL AND s.fail_at > COALESCE(s.basis_at, '-infinity'::timestamp with time zone) THEN 'Last attempt failed'::text
                ELSE 'Silent far longer than expected'::text
            END
            WHEN 'late'::text THEN
            CASE
                WHEN s.basis_at IS NULL THEN 'Has never run — check it is connected'::text
                WHEN s.is_calendar THEN ('Missed the run due '::text || to_char((s.eff_due AT TIME ZONE 'America/Chicago'::text), 'Dy Mon FMDD, FMHH12:MI AM'::text)) || ' CT'::text
                ELSE 'Overdue — no run within its expected window'::text
            END
            ELSE
            CASE
                WHEN s.sched IS NULL THEN 'On demand · no failures seen'::text
                WHEN s.dispatch_only THEN 'Fired on schedule · function result not tracked here'::text
                ELSE 'Working'::text
            END
        END AS status_reason,
    s.work_at AS last_real_work_at,
        CASE
            WHEN s.source = 'runs-alive'::text THEN s.alive_at
            ELSE s.work_at
        END AS last_seen_at,
    s.fail_at AS last_failed_at,
        CASE
            WHEN s.source = 'cron'::text AND s.work_at IS NOT NULL THEN
            CASE
                WHEN s.dispatch_only THEN 'Called its function (HTTP request queued)'::text
                ELSE 'Database job: '::text || "left"(COALESCE(s.last_msg, 'done'::text), 60)
            END
            WHEN s.work_at IS NOT NULL THEN COALESCE(( SELECT "left"(r.note, 160) AS "left"
               FROM runs r
              WHERE r.id = s.id AND (r.outcome = ANY (ARRAY['ok'::text, 'warn'::text])) AND r.note IS NOT NULL
              ORDER BY r.finished_at DESC
             LIMIT 1),
            CASE
                WHEN s.output_page IS NOT NULL THEN ( SELECT ((count(*)::text || ' deal'::text) ||
                        CASE
                            WHEN count(*) = 1 THEN ''::text
                            ELSE 's'::text
                        END) || ' judged/updated'::text
                   FROM press_deals d,
                    ( SELECT r.started_at,
                            r.finished_at
                           FROM runs r
                          WHERE r.id = s.id AND r.outcome = 'ok'::text
                          ORDER BY r.finished_at DESC
                         LIMIT 1) lr
                  WHERE d.page = s.output_page AND d.updated_at >= lr.started_at AND d.updated_at <= (lr.finished_at + '00:02:00'::interval))
                ELSE NULL::text
            END, 'Real work logged'::text)
            ELSE NULL::text
        END AS last_output_note,
        CASE
            WHEN NOT s.enabled OR s.status = 'off'::text THEN NULL::timestamp with time zone
            WHEN s.is_interval AND s.basis_at IS NULL AND (s.status = ANY (ARRAY['failed'::text, 'late'::text])) THEN NULL::timestamp with time zone
            WHEN s.is_interval THEN COALESCE(s.basis_at, s.registered_at) + make_interval(mins => (s.sched ->> 'every'::text)::integer)
            WHEN s.is_calendar THEN
            CASE
                WHEN s.status = 'late'::text THEN s.eff_due
                ELSE press_agent_next_due(s.sched, now())
            END
            ELSE NULL::timestamp with time zone
        END AS next_due_at,
        CASE
            WHEN s.source = ANY (ARRAY['runs-work'::text, 'runs-event'::text]) THEN round(COALESCE(c.mtd, 0::numeric), 4)
            ELSE NULL::numeric
        END AS cost_mtd,
        CASE
            WHEN s.source = ANY (ARRAY['runs-work'::text, 'runs-event'::text]) THEN round(COALESCE(c.mtd, 0::numeric) + COALESCE(c.avg7, 0::numeric) * EXTRACT(epoch FROM ((date_trunc('month'::text, (now() AT TIME ZONE 'America/Chicago'::text)) + '1 mon'::interval) AT TIME ZONE 'America/Chicago'::text) - now()) / 86400.0, 4)
            ELSE NULL::numeric
        END AS cost_projected,
    s.source = ANY (ARRAY['runs-work'::text, 'runs-event'::text]) AS cost_tracked,
    s.fix_hint,
    s.fix_links,
    s.retry_action IS NOT NULL AND s.enabled AS retry_available,
    w.status AS watch_status,
    w.since AS watch_since,
    w.notified_at AS watch_notified_at
   FROM s
     LEFT JOIN costs c ON c.id = s.id
     LEFT JOIN press_agent_watch_state w ON w.id = s.id;
