with v as (select replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(body, $r$p class="note">What the app does is not described in council docs — confirm and describe it.</p>
<div class="links"><$r$, $r$div class="links"><a class="btn" href="https://schnubsy.github.io/press/app-lab.html" rel="noopener" target="_blank">Try it (App Lab)</a><$r$), $r$phase) — X$r$, $r$phase, live in App Lab) — X$r$), $r$unverified">To confirm</span></header>
<p class="what">An Apple app being prototyped on the web first; its web twin is the reference for $r$, $r$live">Live</span></header>
<p class="what">A calm Mac task system with no app window: glass cards on the desktop for Space → Area → Action. Prototyped on the web first (cloud sync, glass whiteboard, guided tour); try it in $r$), $r$nd forge apps &amp; extensions  to confirm">
<header class="card-h"><h3>Va$r$, $r$nd forge apps &amp; extensions  live">
<header class="card-h"><h3>Va$r$), $r$unverified" data-search="vantage an apple app being prototyped on the web first; its web twin is the reference for app lab. github (web phase$r$, $r$live" data-search="vantage a calm mac task system with no app window: glass cards on the desktop for space → area → action. prototyped on the web first (cloud sync, glass whiteboard, guided tour); try it in app lab. github (web phase, live in app lab$r$), $r$="e-pert$r$, $r$="e-rebate-radar-web" data-id="rebate-radar-web" data-group="apps" data-zone="marquee" data-status="unverified" data-wing="family" data-search="rebate radar (web) type a website and see every cashback portal's rate, best first, with a button to open the winner — rebate radar for when chrome isn't handy. marquee — family wing web app — open any time forge apps &amp; extensions family wing to confirm">
<header class="card-h"><h3>Rebate Radar (web)</h3><span class="badge s-unverified">To confirm</span></header>
<p class="what">Type a website and see every cashback portal's rate, best first, with a button to open the winner — Rebate Radar for when Chrome isn't handy.</p>
<dl>
<div><dt>Where</dt><dd>Marquee — family wing</dd></div>
<div><dt>Runs</dt><dd>Web app — open any time</dd></div>
<div><dt>Owner</dt><dd>Forge</dd></div>
<div><dt>Checked</dt><dd><time datetime="2026-10-21">2026-10-21</time></dd></div>
</dl>
<p class="note">Staged by rebate-radar arc web-lookup (2026-10-21): live once the chat deploys rebate-lookup and publishes rebate-radar.html at verify — then set status live.</p>
<div class="links"><a class="btn" href="https://schnubsy.github.io/press/rebate-radar.html" rel="noopener" target="_blank">Open</a><a class="btn" href="https://github.com/schnubsy/rebate-radar" rel="noopener" target="_blank">Repo</a></div>
</article>
<article class="card" id="e-pert$r$), $r$lass="n">24</span></$r$, $r$lass="n">25</span></$r$), $r$ll 77</p$r$, $r$ll 78</p$r$), $r$g</span><b>5</b></li><l$r$, $r$g</span><b>6</b></li><l$r$), $r$n">35</s$r$, $r$n">36</s$r$), $r$e">67 li$r$, $r$e">68 li$r$), $r$n">24</s$r$, $r$n">25</s$r$), $r$a">77 en$r$, $r$a">78 en$r$) as b from public.press_catalog where id = 'catalog' and sha256 = '86ec7381cbaf413dd675d8ba18f0d4790651b458bc83f3e88f2719caaa305a43')
update public.press_catalog p set body = v.b, sha256 = '58a476c72e200f4bab79ab7f79f220cfcf715bee000393f354bc238d571d8799', updated_at = now()
from v where p.id = 'catalog' and p.sha256 = '86ec7381cbaf413dd675d8ba18f0d4790651b458bc83f3e88f2719caaa305a43' and encode(sha256(convert_to(v.b,'UTF8')),'hex') = '58a476c72e200f4bab79ab7f79f220cfcf715bee000393f354bc238d571d8799'
returning p.sha256, octet_length(p.body) as bytes, encode(sha256(convert_to(p.body,'UTF8')),'hex') as computed;