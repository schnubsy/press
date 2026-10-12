// supabase/functions/mailer-check — RETIRED 2026-10-12 (one-off Winston diagnostic; replaced by winston-mail).
Deno.serve(() => new Response(JSON.stringify({ error: 'retired — use winston-mail' }), { status: 410, headers: { 'content-type': 'application/json' } }));
