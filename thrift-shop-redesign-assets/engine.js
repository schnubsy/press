/* Thrift Shop mock engine. TSMock.render(host, cfg) — cfg: {key, nav, pal, type, rows, hd, hl, hero, mode, screen, desk, tune}
   Every aspect is a slot so the Blend panel can mix directions. Presentation artifact, not production code. */
(function(){
  var D=function(){ return window.TS_DIRS; };
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
  function clone(o){ return JSON.parse(JSON.stringify(o)); }

  /* ---------- navigation models (dest -> sub-screens) ---------- */
  var NAVS={
    grid:[{id:"feed",l:"Feed",cnt:3,subs:[["Inbox","feed"]]},{id:"rules",l:"Rules",subs:[["Gift cards","rules"],["Sales","watch"]]},{id:"system",l:"System",cnt:"!",subs:[["Sources","sources"],["Alerts","alerts"]]}],
    vogue:[{id:"feed",l:"Today",subs:[["Today","feed"]]},{id:"index",l:"The Index",subs:[["Sources","sources"],["Gift cards","rules"],["Sales","watch"],["Alerts","alerts"]]}],
    steel:[{id:"feed",l:"feed",subs:[["feed","feed"]]},{id:"config",l:"config",subs:[["/sources","sources"],["/rules","rules"],["/sales","watch"],["/alerts","alerts"]]}],
    calm:[{id:"feed",l:"Deals",cnt:3,ic:"tray",subs:[["Deals","feed"]]},{id:"rules",l:"Rules",ic:"sliders",subs:[["Gift cards","rules"],["Sales","watch"]]},{id:"settings",l:"Settings",ic:"gear",cnt:3,subs:[["Sources","sources"],["Alerts","alerts"]]}],
    neon:[{id:"feed",l:"Feed",cnt:3,subs:[["Feed","feed"]]},{id:"rules",l:"Rules",subs:[["Gift cards","rules"],["Sales","watch"]]},{id:"sources",l:"Sources",cnt:3,subs:[["Sources","sources"]]},{id:"settings",l:"Settings",subs:[["Settings","alerts"]]}],
    cup:[{id:"feed",l:"Feed",cnt:3,ic:"tray",subs:[["Feed","feed"]]},{id:"rules",l:"Rules",ic:"sliders",subs:[["Gift cards","rules"],["Sales & offers","watch"]]},{id:"sources",l:"Sources",ic:"antenna",cnt:3,subs:[["Sources","sources"]]},{id:"settings",l:"Settings",ic:"gear",subs:[["Settings","alerts"]]}]
  };
  NAVS.ledger=NAVS.cup;
  var TITLES={feed:"Feed",rules:"Gift-card rules",watch:"Sales & offers",sources:"Sources",alerts:"Settings"};
  var ICONS={
    tray:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/></svg>',
    sliders:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    antenna:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="11" r="2"/><path d="M12 13v8M7.5 6.5a6 6 0 0 0 0 9M16.5 6.5a6 6 0 0 1 0 9M4.6 3.6a10 10 0 0 0 0 14.8M19.4 3.6a10 10 0 0 1 0 14.8"/></svg>',
    gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>'
  };
  var CHEV='<svg class="cv" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- health glyphs per style ---------- */
  var HWORD={ok:"OK",empty:"Empty",blocked:"Blocked",signin:"Sign in",partial:"Partial",off:"Off"};
  var HVAR={ok:"--hOk",empty:"--hEmpty",blocked:"--hBlocked",signin:"--hSignin",partial:"--hPartial",off:"--hEmpty"};
  function glyph(style,h){
    var s='<svg class="hg" data-h="'+h+'" viewBox="0 0 16 16" aria-hidden="true" style="color:var('+HVAR[h]+')">', e='</svg>', p="";
    if(style==="grid"){ p={ok:'<rect x="2" y="2" width="12" height="12" fill="currentColor"/>',empty:'<rect x="2.75" y="2.75" width="10.5" height="10.5" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      blocked:'<rect x="2" y="2" width="12" height="12" fill="currentColor"/><path d="M5 5l6 6M11 5l-6 6" stroke="#fff" stroke-width="1.8"/>',signin:'<rect x="2.75" y="2.75" width="10.5" height="10.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v4M8 10.6v.8" stroke="currentColor" stroke-width="1.8"/>',
      partial:'<rect x="2.75" y="2.75" width="10.5" height="10.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="8" width="12" height="6" fill="currentColor"/>',off:'<path d="M3 8h10" stroke="currentColor" stroke-width="1.5"/>'}[h]; }
    else if(style==="steel"){ p={ok:'<path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.2"/>',empty:'<rect x="2.5" y="2.5" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"/>',
      blocked:'<rect x="1" y="1" width="14" height="14" fill="currentColor"/>',signin:'<rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"/>',partial:'<rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="2" width="6" height="12" fill="currentColor"/>',off:'<path d="M2 8h12" stroke="currentColor" stroke-width="1.5"/>'}[h]; }
    else if(style==="neon"){ p={ok:'<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="2.2"/>',empty:'<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2.4"/>',
      blocked:'<path d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5M13.2 10.3A5.5 5.5 0 0 1 3.4 11M2.6 7.2A5.5 5.5 0 0 1 5.5 3.1" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4 12L12 4" stroke="currentColor" stroke-width="1.6"/>',
      signin:'<path d="M10.5 3.1A5.5 5.5 0 1 1 5.5 3.1" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/>',partial:'<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-opacity=".3" stroke-width="2.2"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2.2"/>',off:'<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="1.2"/>'}[h]; }
    else if(style==="cup"){ p={ok:'<circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M4.8 8.3l2.1 2.1 4.3-4.6" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',empty:'<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2.4 2"/>',
      blocked:'<path d="M5.1 1h5.8L15 5.1v5.8L10.9 15H5.1L1 10.9V5.1z" fill="currentColor"/><path d="M4.5 8h7" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',signin:'<circle cx="8" cy="8" r="7" fill="currentColor"/><circle cx="8" cy="6.2" r="2" fill="#fff"/><path d="M4.4 12a4 4 0 0 1 7.2 0" fill="#fff"/>',
      partial:'<circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.7a6.3 6.3 0 0 1 0 12.6z" fill="currentColor"/>',off:'<circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.4"/>'}[h]; }
    else if(style==="vogue"){ p={ok:'<path d="M8 1.5L14.5 8 8 14.5 1.5 8z" fill="currentColor"/>',empty:'<path d="M8 2.5L13.5 8 8 13.5 2.5 8z" fill="none" stroke="currentColor" stroke-width="1.2"/>',
      blocked:'<path d="M8 1.5L14.5 8 8 14.5 1.5 8z" fill="currentColor"/><path d="M5.5 8h5" stroke="#fff" stroke-width="1.6"/>',signin:'<path d="M8 2.5L13.5 8 8 13.5 2.5 8z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/>',
      partial:'<path d="M8 2.5L13.5 8 8 13.5 2.5 8z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 1.5L14.5 8 8 14.5z" fill="currentColor"/>',off:'<path d="M3 8h10" stroke="currentColor" stroke-width="1.2"/>'}[h]; }
    else { p={ok:'<circle cx="8" cy="8" r="6" fill="currentColor"/>',empty:'<circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      blocked:'<circle cx="8" cy="8" r="6" fill="currentColor"/><path d="M5 8h6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',signin:'<circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2.2" fill="currentColor"/>',
      partial:'<circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 2.75a5.25 5.25 0 0 1 0 10.5z" fill="currentColor"/>',off:'<circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="1.2"/>'}[h]; }
    return s+p+e;
  }
  function health(style,h){ return '<span class="gl">'+glyph(style,h)+'<span class="hwd" style="color:var('+(h==="ok"||h==="empty"||h==="off"?"--ink2":HVAR[h])+')">'+HWORD[h]+'</span></span>'; }

  /* ---------- controls ---------- */
  function sw(on,label){ return '<button class="sw" role="switch" aria-checked="'+(!!on)+'" aria-label="'+esc(label)+'"><i></i></button>'; }
  function vb(val,opts,label){ return '<button class="vb" data-opts="'+esc((opts||[]).join("|"))+'" aria-label="'+esc(label)+': '+esc(val)+'">'+esc(val)+'</button>'; }
  function row(lb,opt){ opt=opt||{};
    return '<div class="rw'+(opt.c4?" c4":"")+(opt.off?" off":"")+(opt.full?" full":"")+'" data-q="'+esc((opt.q||lb).toLowerCase())+'"><div class="rl"><span class="lb">'+lb+'</span>'+(opt.sb?'<span class="sb">'+opt.sb+'</span>':"")+'</div><span class="ld" aria-hidden="true"></span>'
      +(opt.v!=null?'<span class="rv">'+opt.v+'</span>':"")+(opt.v2!=null?'<span class="rv">'+opt.v2+'</span>':"")+(opt.c!=null?'<span class="rc">'+opt.c+'</span>':"")+'</div>'; }
  var PCTS=["5%","10%","15%","20%","25%","30%","35%","40%","45%","50%"], DENOMS=["Any","$10","$25","$50","$75","$100","$150","$200"], MINS=["Any","≥5%","≥10%","≥15%","≥20%","≥25%","≥30%","≥35%","≥40%","≥45%","≥50%"];

  /* ---------- sections ---------- */
  var DEFAULT_OPEN={inbox:1,processed:0,run:1,gcdefaults:1,restaurant:1,retail:0,other:0,retailer:0,cashlike:0,blocked:0,watch:1,counts:0,overrides:0,also:0,
    email:1,feed:1,direct:1,market:1,channels:1,timing:1,schedule:0,health:1,savings:0,bad:0,learned:0};
  function groupRules(d,g){ return d.rules.filter(function(r){ return r.group===g; }); }
  function brandSec(d,g,title){
    var rs=groupRules(d,g), on=rs.filter(function(r){return r.on;}).length;
    var mostly={}; rs.forEach(function(r){ mostly[r.pct]=(mostly[r.pct]||0)+1; }); var mp=Object.keys(mostly).sort(function(a,b){return mostly[b]-mostly[a];})[0];
    var odd=rs.filter(function(r){ return String(r.pct)!==mp; }).map(function(r){ return r.brand+" "+r.pct+"%"; });
    return {t:title,n:rs.length,sum:on+" on, "+mp+"% min"+(odd.length?", except "+odd.slice(0,2).join(", ")+(odd.length>2?" +"+(odd.length-2):""):""),
      help:"Alert when a "+title.toLowerCase()+" card is at least this % off and at least this value. Default for new brands: "+d.defaults.pct+"%, $"+d.defaults.denom+".",
      html:'<div class="colh"><span>Brand</span><span>Min %</span><span>Min $</span><span>On</span></div><div class="rows">'+rs.map(function(r){
        return row(esc(r.brand),{c4:1,off:!r.on,q:r.brand,v:vb(r.pct+"%",PCTS,"Min % off for "+r.brand),v2:vb(r.denom?("$"+r.denom):"Any",DENOMS,"Min card value for "+r.brand),c:sw(r.on,r.brand)});
      }).join("")+'</div>'};
  }
  function chipSec(list,title,ph,help,sum){
    return {t:title,n:list.length,sum:sum||list.join(", "),help:help,
      html:'<div class="chips">'+list.map(function(x){ return '<button class="chip" data-q="'+esc(x.toLowerCase())+'" aria-label="Remove '+esc(x)+'">'+esc(x)+'<b aria-hidden="true">×</b></button>'; }).join("")+'</div>'
        +'<div class="addr"><input type="text" placeholder="'+esc(ph)+'" aria-label="'+esc(ph)+'"><button class="ab">Add</button></div>'};
  }
  function dealRow(x,hl){
    var kind={card:"Gift card",sale:"Sale",offer:"Offer"}[x.kind];
    var meta=[x.where&&x.where!=="Email"?"at "+x.where:"Email offer", x.src, x.when, x.exp?('<span class="'+(x.soon?"soon":"")+'">exp '+x.exp+'</span>'):null, x.status?('<b>'+x.status+(x.saved?" "+x.saved:"")+'</b>'):null].filter(Boolean);
    return '<div class="deal '+x.verdict+'" data-q="'+esc((x.brand+" "+x.line).toLowerCase())+'"><div class="bd">'+esc(x.badge)+'<small>'+(x.verdict==="hit"?(x.badge==="Free"||x.badge.charAt(0)==="$"?"value":"off"):"near")+'</small></div>'
      +'<div><div class="br">'+(x.isNew?'<span class="nw" role="img" aria-label="New"></span>':"")+esc(x.brand)+'<span class="kd">'+kind+'</span></div>'
      +'<div class="ln">'+esc(x.line)+'</div><div class="mt">'+meta.map(function(m){ return '<span>'+m+'</span>'; }).join("")+'</div></div>'
      +'<button class="ic mo" aria-label="More for '+esc(x.brand)+'">⋯</button>'
      +(x.status?"":'<div class="ac"><button class="ab open">Open deal</button><button class="ab">'+(x.kind==="offer"?"Used":"Bought")+'</button><button class="ab">Skip</button><button class="ab">Bad</button></div>')+'</div>';
  }
  function SECS(d,cfg){ var hl=cfg.hl; var a=d.alerts, h=d.health, m=d.metrics;
    var srcSec=function(g,title){
      var ss=d.sources.filter(function(s){return s.g===g;}), bad=ss.filter(function(s){ return s.h==="blocked"||s.h==="signin"; }).length;
      var counts={}; ss.forEach(function(s){ counts[s.h]=(counts[s.h]||0)+1; });
      return {t:title,n:ss.length,flag:bad?(bad+" need"+(bad===1?"s":"")+" you"):null,sum:Object.keys(counts).map(function(k){ return counts[k]+" "+HWORD[k].toLowerCase(); }).join(", "),
        help:"OK = checked on schedule and read fine. Empty = read fine, nothing new. Partial = only some of it read. Blocked = the site refused the fetch. Sign in = needs you to reconnect.",
        html:'<div class="rows">'+ss.map(function(s){
          var sb=(s.h==="ok"||s.h==="off")?(s.lane+", "+s.cad+", "+s.last):(esc(s.detail)+'<br><span style="color:var(--ink3)">'+s.lane+", "+s.cad+", "+s.last+'</span>');
          if(s.action) sb+='<span style="display:block;margin-top:6px"><button class="ab pri">'+s.action+'</button></span>';
          return row(esc(s.name),{off:!s.on,q:s.name,sb:sb,v:health(hl,s.h),c:sw(s.on,s.name)});
        }).join("")+'</div>'};
    };
    var wOn=d.watches.filter(function(w){return w.on;}).length;
    return {
      inbox:{t:"Inbox",n:d.deals.length,flag:"3 new",sum:"3 new, 5 hits, 2 near",help:"Hits beat your rules and were alerted. Near misses were close. Swipe left to delete; ⋯ for Block store.",
        html:'<div class="feedrows">'+d.deals.map(function(x){return dealRow(x,hl);}).join("")+'</div>'},
      processed:{t:"Processed",n:d.processed.length,sum:"Bought, Skipped and Bad land here",help:"Kept 30 days. The savings log keeps every Bought forever.",html:'<div class="feedrows">'+d.processed.map(function(x){return dealRow(x,hl);}).join("")+'</div>'},
      gcdefaults:{t:"Defaults",n:null,sum:d.defaults.pct+"% off, $"+d.defaults.denom+" min card",help:"New brands start here. Costco and Sam's alert only on an extra stack; HEB bonus cards add to the card you buy.",
        html:'<div class="rows">'+row("Default min % off",{v:vb(d.defaults.pct+"%",PCTS,"Default min %")})+row("Default min card value",{v:vb("$"+d.defaults.denom,DENOMS,"Default min card")})+'</div><div class="addr"><input type="text" placeholder="Add a brand" aria-label="Add a brand"><button class="ab">Add</button></div>'},
      restaurant:brandSec(d,"restaurant","Restaurants"),retail:brandSec(d,"retail","Retail"),other:brandSec(d,"other","Other"),
      retailer:{t:"Warehouse & grocery",n:3,sum:"Costco, Sam's stack only; HEB booster",help:"Stack only: alert only when an extra $ off stacks on the usual ~20% member price. Booster: a free HEB card adds to the discount on the card you buy.",
        html:'<div class="rows">'+groupRules(d,"retailer").map(function(r){ return row(esc(r.brand),{q:r.brand,v:(r.mode==="stack"?"Stack only":"Bonus booster"),c:sw(r.on,r.brand)}); }).join("")+'</div>'},
      cashlike:chipSec(d.cashLike,"Cash-like cards","Add a store","A free bonus card from these stores counts as cash: $10 free on $50 is 20%. Any other store's bonus card is judged on the total: 17%."),
      blocked:chipSec(d.blocked,"Blocked stores","Block a store","Never shown or alerted: gift cards, sale finds and email offers. Same list everywhere."),
      watch:{t:"Sale watch",n:wOn+" of 10",sum:d.watches.filter(function(w){return w.state==="match";}).length+" matched this week",help:"Each term is searched 3× a day. Hold a row to reorder. Min % applies to that term only.",
        html:'<div class="rows">'+d.watches.map(function(w){
          var mline=w.state==="match"?'<a class="wm" href="#" onclick="return false">'+esc(w.match)+'</a><div class="wx"><span>'+w.when+'</span><span>'+w.n+' match'+(w.n===1?"":"es")+' in 30 days</span></div>':'<span class="wm quiet">'+esc(w.match)+'</span>';
          return '<div class="wt" data-q="'+esc((w.term+" "+w.match).toLowerCase())+'"><div class="wh"><span class="wn"'+(w.on?"":' style="color:var(--ink3)"')+'>'+esc(w.term)+'</span>'+vb(w.min,MINS,"Min % off for "+w.term)+sw(w.on,"Watch "+w.term)+'<button class="ic" aria-label="More for '+esc(w.term)+'">⋯</button></div>'+mline+'</div>';
        }).join("")+'</div><div class="addr"><input type="text" placeholder="Watch a product" aria-label="Watch a product">'+vb("Any",MINS,"Min % for new watch")+'<button class="ab pri">Watch</button></div>'},
      counts:{t:"Email offers that count",n:d.offerTypes.filter(function(o){return o.on;}).length+" of 8",sum:"Free meals, BOGO free, rewards in 7 days, $10+ off, 40%+ off",help:"Read from your Outlook offers folder. A bonus gift card in an email is judged by your gift-card rules.",
        html:'<div class="rows">'+d.offerTypes.map(function(o){ return row(esc(o.label),{off:!o.on,v:o.val?(o.opts&&o.opts.length>1?vb(o.val,o.opts,o.label):'<span>'+esc(o.val)+'</span>'):null,c:sw(o.on,o.label)}); }).join("")+'</div>'},
      overrides:{t:"Brand overrides",n:d.brandOverrides.length,sum:d.brandOverrides.map(function(b){return b.brand+" "+b.mode.toLowerCase();}).join(", "),help:"Always counts every offer from the brand. Never mutes it.",
        html:'<div class="rows">'+d.brandOverrides.map(function(b){ return row(esc(b.brand),{q:b.brand,v:vb(b.mode,["Always","Never"],b.brand+" override"),c:'<button class="ic" aria-label="Remove '+esc(b.brand)+'">×</button>'}); }).join("")+'</div><div class="addr"><input type="text" placeholder="Add a brand" aria-label="Add a brand override"><button class="ab">Add</button></div>'},
      also:{t:"Also count",n:1,sum:d.alsoCount,help:"Plain words, read with every email. Up to 300 characters.",
        html:'<div class="addr"><input type="text" value="'+esc(d.alsoCount)+'" aria-label="Also count"><button class="ab">Save</button></div>'},
      email:srcSec("email","Email"),feed:srcSec("feed","Deal feeds"),direct:srcSec("direct","Retailers"),market:srcSec("market","Marketplaces"),
      channels:{t:"Alerts",n:null,sum:"iPhone and email, instant",help:"Push goes through Pushover. A test push checks the full path to your phone.",
        html:'<div class="rows">'+row("iPhone push",{sb:a.pushHealth,c:'<button class="ab">Test</button>'+sw(a.push,"iPhone push")})+row("Email",{c:sw(a.email,"Email")})+row("Alert mode",{v:vb(a.mode,["Instant","Digest only"],"Alert mode")})+'</div>'},
      timing:{t:"Quiet hours & digest",n:null,sum:"Quiet 10 pm to 7 am, digest 7:30 am",help:"Hits found in quiet hours arrive when they end. The digest is one email of the day's near misses.",
        html:'<div class="rows">'+row("Quiet hours",{c:sw(a.quiet,"Quiet hours")})+row("From",{v:vb(a.quietFrom,["9:00 pm","10:00 pm","11:00 pm"],"Quiet from")})+row("To",{v:vb(a.quietTo,["6:00 am","7:00 am","8:00 am"],"Quiet to")})
          +row("Near-miss digest",{c:sw(a.digest,"Near-miss digest")})+row("Digest time",{v:vb(a.digestTime,["7:00 am","7:30 am","8:00 am"],"Digest time")})+'</div>'},
      schedule:{t:"Schedule",n:null,sum:"Feeds 3× a day, email 2×, stores Wed",help:"More often costs more model spend. The weekly store check runs in Chrome on the Mac.",
        html:'<div class="rows">'+row("Feed checks",{v:vb(a.feedCad,["3× a day","Every 30 min","Once a day"],"Feed checks")})+row("Email offer scans",{v:vb(a.offerCad,["2× a day","3× a day","Once a day"],"Email scans")})+row("Weekly store check",{v:vb(a.weeklyDay,["Monday","Wednesday","Friday","Saturday"],"Store check day")})+'</div>'},
      health:{t:"Agent health",n:null,flag:"1 needs you",sum:"Ran 12 min ago, backlog 0, Outlook sign-in",help:"Check judging runs a fixed golden set through the model (read-only, under 5¢). Full test runs a real tick and always sends a report.",
        html:'<div class="rows">'+row("Last run",{v:h.lastRun})+row("Judge backlog",{v:health(hl,"ok").replace(">OK<",">"+h.backlog+"<")})+row("Email offers",{v:health(hl,"signin")})
          +row("Judging accuracy",{sb:h.judging,c:'<button class="ab">Check</button>'})+row("Full test",{sb:"Real tick plus a push and email report",c:'<button class="ab">Run</button>'})+'</div>'},
      savings:{t:"Savings",n:m.total,sum:m.total+" saved, "+m.month+" this month",help:"From the savings log: every Bought, kept forever.",
        html:'<div class="tiles"><div>Total<b>'+m.total+'</b></div><div>This month<b>'+m.month+'</b></div><div>Used rate<b>'+m.rate+'</b></div><div>Used<b>'+m.used+'</b></div><div>Skipped<b>'+m.skipped+'</b></div><div>Alerts, 30 d<b>'+m.alerts+'</b></div></div>'
          +'<div class="rows">'+m.byKind.map(function(k){ return row(k[0],{v:k[1]}); }).join("")+row("Too-good flags, 30 d",{v:String(m.tooGood)})+'</div>'},
      bad:{t:"Bad backlog",n:d.bad.length,sum:d.bad.length+" waiting for Monday's loop",help:"Deals you flagged Bad. The Monday loop turns them into rules.",
        html:'<div class="rows">'+d.bad.map(function(b){ return row(esc(b.brand),{sb:b.reason+(b.auto?", auto-flagged":""),v:b.when,c:'<button class="ic" aria-label="Unflag">×</button>'}); }).join("")+'</div>'},
      learned:{t:"What I've learned",n:d.learned,sum:d.learned+" rules from your Bad flags",help:"The plain-words rules every deal is judged by.",
        html:'<div class="rows">'+row("Bonus points never count",{v:"8 flags"})+row("A set price isn't a discount",{v:"8 flags"})+row("BOGO 50% off is 25% off",{v:"3 flags"})+row("+13 more",{v:'<button class="ab">View</button>'})+'</div>'}
    };
  }
  var SCREEN_SECS={feed:["inbox","processed"],rules:["gcdefaults","restaurant","retail","other","retailer","cashlike","blocked"],watch:["watch","counts","overrides","also"],
    sources:["email","feed","direct","market"],alerts:["channels","timing","health","schedule","savings","bad","learned"]};

  function isOpen(key,id){ try{ var v=localStorage.getItem("tsmock:"+key+":"+id); if(v!=null) return v==="1"; }catch(e){} return !!DEFAULT_OPEN[id]; }
  function setOpen(key,id,on){ try{ localStorage.setItem("tsmock:"+key+":"+id,on?"1":"0"); }catch(e){} }

  function secHtml(cfg,st,id,s,i){
    var open=isOpen(cfg.key,id), hid="h-"+cfg.uid+"-"+id;
    var no=(i<9?"0":"")+(i+1);
    return '<section class="sec" data-sec="'+id+'" data-open="'+open+'"><div class="sh"><button class="tg" aria-expanded="'+open+'" aria-controls="b-'+cfg.uid+'-'+id+'">'
      +(cfg.hd==="grid"?'<span class="no">'+no+'</span>':"")+(cfg.hd==="steel"?'<span class="tt">/'+esc(s.t.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/-$/,""))+'</span>':'<span class="tl"><span class="tt">'+esc(s.t)+'</span>'+(s.n!=null?'<span class="cn">'+esc(s.n)+'</span>':"")+'</span>')
      +(cfg.hd==="steel"&&s.n!=null?'<span class="cn">'+esc(s.n)+'</span>':"")
      +(cfg.hd==="calm"?'<span class="sum">'+esc(s.sum||"")+'</span>':"")+'</button>'
      +(s.flag?'<span class="fl">'+esc(s.flag)+'</span>':"")
      +(s.help?'<button class="hp" aria-label="Help: '+esc(s.t)+'" aria-expanded="'+(!!st.help[id])+'" aria-controls="'+hid+'"><span>?</span></button>':"")+CHEV+'</div>'
      +(st.help[id]?'<div class="help" id="'+hid+'">'+esc(s.help)+'</div>':"")
      +'<div class="body" id="b-'+cfg.uid+'-'+id+'">'+s.html+'</div></section>';
  }

  function heroHtml(cfg,d){
    var hv=cfg.hero;
    if(hv==="grid") return '<div class="hero"><div class="al"><b>3</b><span>New</span></div><div><b>5</b><span>Hits</span></div><div><b>$96</b><span>Saved Oct</span></div><div class="al"><b>3</b><span>Sources need you</span></div></div>';
    if(hv==="vogue") return '<div class="hero"><span class="ey">Cover story, Wed 22 Oct</span><h3>DoorDash <em>$100 for $80, and $20 at Target</em></h3><p>The best deal in today’s issue. 7 more inside.</p><button class="ab">Open deal</button></div>';
    if(hv==="steel") return '<div class="hero"><b>tick 09:29</b> ok, 20 sources, 31 judged, <b>3 hits</b>, 3 alerted<br>backlog 0, next 12:00<br><span class="bad">3 need you</span> outlook sign-in, r/giftcarddeals 403, best buy captcha</div>';
    if(hv==="calm") return '<div class="hero"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="6" fill="var(--acc)"/><circle cx="32" cy="32" r="15" fill="none" stroke="var(--acc)" stroke-opacity=".45" stroke-width="1.5"/><circle cx="32" cy="32" r="25" fill="none" stroke="var(--acc)" stroke-opacity=".2" stroke-width="1.5"/></svg><div><b>3 new deals</b><span>Last check 12 min ago. 3 sources need you.</span></div></div>';
    if(hv==="neon"){ var pts=d.metrics.spark, w=360, hgt=80, mx=Math.max.apply(null,pts);
      var path=pts.map(function(v,i){ return (i?"L":"M")+(i*(w/(pts.length-1))).toFixed(1)+" "+(hgt-6-(v/mx)*(hgt-20)).toFixed(1); }).join(" ");
      return '<div class="hero"><span>Saved this month</span><b>$96</b><span>3 new, 5 hits, last run 12 min ago</span><svg viewBox="0 0 360 80" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ng'+cfg.uid+'" x1="0" x2="1"><stop offset="0" stop-color="var(--acc)"/><stop offset="1" stop-color="var(--acc2)"/></linearGradient><linearGradient id="nf'+cfg.uid+'" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--acc2)" stop-opacity=".35"/><stop offset="1" stop-color="var(--acc2)" stop-opacity="0"/></linearGradient></defs><path d="'+path+' L360 80 L0 80Z" fill="url(#nf'+cfg.uid+')"/><path d="'+path+'" fill="none" stroke="url(#ng'+cfg.uid+')" stroke-width="2.5"/></svg></div>'; }
    if(hv==="ledger") return '<div class="hero"><div class="top"><svg viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="46" fill="none" stroke="var(--acc)" stroke-opacity=".12" stroke-width="1.5"/><circle cx="48" cy="48" r="36" fill="none" stroke="var(--acc)" stroke-opacity=".24" stroke-width="1.5"/><circle cx="48" cy="48" r="26" fill="var(--accS)" stroke="var(--acc)" stroke-opacity=".5" stroke-width="1.5"/><text x="48" y="58" text-anchor="middle" font-size="30" font-weight="700" fill="var(--accT)">3</text></svg><div><b>3 new deals</b><span>Last check 12 min ago · next at noon</span></div></div>'
      +'<div class="split"><div><b>5</b><span>Hits</span></div><div><b>$96</b><span>Saved Oct</span></div><div><b>$1,284</b><span>Saved total</span></div><div class="al"><b>3</b><span>Need you</span></div></div></div>';
    if(hv==="cup") return '<div class="hero wrap"><b>3 new</b>, last checked 12 min ago</div>';
    return "";
  }
  function srcSummary(cfg,d){
    var c={ok:0,empty:0,partial:0,blocked:0,signin:0}; d.sources.forEach(function(s){ if(c[s.h]!=null) c[s.h]++; });
    var need=d.sources.filter(function(s){ return s.h==="blocked"||s.h==="signin"; }).map(function(s){return s.name;});
    return '<div class="ssum" role="list" aria-label="Source health">'+["ok","empty","partial","blocked","signin"].map(function(k){ return '<div role="listitem"><b>'+glyph(cfg.hl,k)+c[k]+'</b>'+HWORD[k]+'</div>'; }).join("")+'</div>'
      +'<p class="need"><b>'+need.length+' need you:</b> '+esc(need.join(", "))+'</p>';
  }

  function navHtml(cfg,st){
    var nav=NAVS[cfg.nav], curDest=destOf(cfg.nav,st.screen);
    var ds=nav.map(function(n){ var cur=n.id===curDest.id;
      return '<button class="d" data-dest="'+n.id+'"'+(cur?' aria-current="true"':"")+'>'+(n.ic&&(cfg.nav==="calm"||cfg.nav==="cup"||cfg.nav==="ledger")?ICONS[n.ic]:"")+'<span>'+esc(n.l)+'</span>'+(n.cnt&&cfg.nav!=="vogue"&&cfg.nav!=="steel"?'<span class="cnt">'+n.cnt+'</span>':"")+'</button>'; }).join("");
    if(cfg.nav==="vogue") return '<nav class="nav" aria-label="Main"><span class="brand">Thrift Shop</span><span class="ds">'+ds+'</span></nav>';
    if(cfg.nav==="steel") return '<nav class="nav" aria-label="Main">'+ds+'<label class="go"><span aria-hidden="true">go</span><input type="search" placeholder="any setting" aria-label="Go to any setting" data-go></label></nav>';
    return '<nav class="nav" aria-label="Main">'+ds+'</nav>';
  }
  function destOf(navId,screen){ var nav=NAVS[navId]; for(var i=0;i<nav.length;i++){ for(var j=0;j<nav[i].subs.length;j++) if(nav[i].subs[j][1]===screen) return {id:nav[i].id,n:nav[i]}; } return {id:nav[0].id,n:nav[0]}; }
  function subHtml(cfg,st){
    var dd=destOf(cfg.nav,st.screen).n; if(dd.subs.length<2) return "";
    var b=dd.subs.map(function(s){ return '<button data-scr="'+s[1]+'"'+(s[1]===st.screen?' aria-current="true"':"")+'>'+esc(s[0])+'</button>'; }).join("");
    if(cfg.nav==="cup"||cfg.nav==="ledger") return '<div class="sub"><div class="seg" role="tablist">'+b+'</div></div>';
    return '<div class="sub" role="tablist">'+b+'</div>';
  }

  function render(host,cfg){
    var dirs=D(); cfg.uid=cfg.uid||Math.random().toString(36).slice(2,7);
    var st=host._st||(host._st={screen:cfg.screen||"feed",help:{},data:clone(window.TS_DATA)});
    if(cfg.screen&&cfg._screenForced!==cfg.screen){ st.screen=cfg.screen; cfg._screenForced=cfg.screen; }
    host._cfg=cfg;
    var P=dirs[cfg.pal].palette[cfg.mode]||dirs[cfg.pal].palette.light, T=dirs[cfg.type].type, M=dirs[cfg.rows].metrics, tu=cfg.tune||{};
    var vars={"--bg":P.bg,"--sf":P.surface,"--sf2":P.surface2,"--ink":P.ink,"--ink2":P.ink2,"--ink3":P.ink3,"--line":P.line,"--acc":tu.acc||P.acc,"--acc2":P.acc2||tu.acc||P.acc,"--accT":tu.acc||P.accText,"--accI":P.accInk,"--accS":P.accSoft,
      "--hOk":P.hOk,"--hEmpty":P.hEmpty,"--hBlocked":P.hBlocked,"--hSignin":P.hSignin,"--hPartial":P.hPartial,
      "--ui":T.ui,"--hd":T.head,"--num":T.num,"--fs":(tu.fs||T.fs)+"px","--lh":T.lh,"--hw":T.hw,"--row":(tu.row||M.row)+"px","--u":(tu.u||M.u)+"px","--r":(tu.r!=null?tu.r:M.r)+"px","--ctl":tu.ctl||M.ctl};
    var style=Object.keys(vars).map(function(k){ return k+":"+vars[k]; }).join(";");
    var d=st.data, secs=SECS(d,cfg), ids=SCREEN_SECS[st.screen];
    var cls="ts nav-"+cfg.nav+" rs-"+cfg.rows+" hd-"+cfg.hd+" hl-"+cfg.hl+" hero-"+cfg.hero+" pal-"+cfg.pal+" m-"+cfg.mode+(cfg.desk?" desk":"");
    var main="";
    if(cfg.nav==="cup"||cfg.nav==="ledger") main+='<div class="ltitle">'+esc(TITLES[st.screen])+'</div>';
    main+=subHtml(cfg,st);
    var tools=(st.screen!=="alerts")?'<div class="tools"><label class="search"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.6"/></svg><input type="search" data-filter placeholder="'+({feed:"Search deals",rules:"Search 63 brands and lists",watch:"Search watches, types, brands",sources:"Search sources"}[st.screen])+'" aria-label="Search this screen" value="'+esc(st.q||"")+'"></label>'+(st.screen==="feed"?'<button class="tbtn" aria-label="Filter and sort">Filter</button>':'<button class="tbtn" data-collapse>Collapse</button>')+'</div>':"";
    var secsHtml=ids.map(function(id,i){ return secHtml(cfg,st,id,secs[id],i); }).join("");
    if(st.screen==="feed"){
      if(cfg.desk){ main+='<div class="feedcols"><div>'+heroHtml(cfg,d)+tools+secsHtml+'</div><div>'+secHtml(cfg,st,"savings",secs.savings,7)+'<div class="sec"><div class="sh"><span class="tt">Source health</span></div>'+srcSummary(cfg,d)+'</div></div></div>'; }
      else main+=heroHtml(cfg,d)+tools+secsHtml;
    } else if(st.screen==="sources"){ main+=srcSummary(cfg,d)+tools+(cfg.desk?'<div class="cols">'+secsHtml+'</div>':secsHtml); }
    else main+=tools+(cfg.desk?'<div class="cols">'+secsHtml+'</div>':secsHtml);
    host.innerHTML='<div class="'+cls+'" style="'+esc(style)+'" data-screen="'+st.screen+'">'
      +'<div class="ts-status" aria-hidden="true"><span>9:41</span><span>Thrift Shop</span></div>'+navHtml(cfg,st)
      +'<main class="ts-main">'+main+'</main></div>';
    if(st.q) applyFilter(host,st.q);
    if(!host._wired){ wire(host); host._wired=true; }
  }
  function applyFilter(host,q){
    q=(q||"").toLowerCase().trim();
    host.querySelectorAll("[data-q]").forEach(function(r){ r.style.display=(!q||r.getAttribute("data-q").indexOf(q)>=0)?"":"none"; });
    if(q) host.querySelectorAll(".sec").forEach(function(s){ var any=[].some.call(s.querySelectorAll("[data-q]"),function(r){ return r.style.display!=="none"; }); if(any) s.setAttribute("data-open","true"); });
  }
  function wire(host){
    host.addEventListener("click",function(ev){
      var cfg=host._cfg, st=host._st, b=ev.target.closest("button"); if(!b||!host.contains(b)) return;
      if(b.hasAttribute("data-dest")){ var n=NAVS[cfg.nav].filter(function(x){return x.id===b.getAttribute("data-dest");})[0]; st.screen=n.subs[0][1]; st.q=""; render(host,cfg); host.dispatchEvent(new CustomEvent("tsscreen",{bubbles:true,detail:st.screen})); return; }
      if(b.hasAttribute("data-scr")){ st.screen=b.getAttribute("data-scr"); st.q=""; render(host,cfg); host.dispatchEvent(new CustomEvent("tsscreen",{bubbles:true,detail:st.screen})); return; }
      if(b.classList.contains("tg")){ var sec=b.closest(".sec"), id=sec.getAttribute("data-sec"), on=sec.getAttribute("data-open")!=="true"; sec.setAttribute("data-open",on); b.setAttribute("aria-expanded",on); setOpen(cfg.key,id,on); return; }
      if(b.classList.contains("hp")){ var id2=b.closest(".sec").getAttribute("data-sec"); st.help[id2]=!st.help[id2]; render(host,cfg); return; }
      if(b.hasAttribute("data-collapse")){ host.querySelectorAll(".sec").forEach(function(s){ s.setAttribute("data-open","false"); setOpen(cfg.key,s.getAttribute("data-sec"),false); }); return; }
      if(b.classList.contains("sw")){ var v=b.getAttribute("aria-checked")!=="true"; b.setAttribute("aria-checked",v); var rw=b.closest(".rw"); if(rw) rw.classList.toggle("off",!v); return; }
      if(b.classList.contains("vb")){ var o=(b.getAttribute("data-opts")||"").split("|").filter(Boolean); if(o.length>1){ var i=o.indexOf(b.textContent); b.textContent=o[(i+1)%o.length]; } return; }
    });
    host.addEventListener("input",function(ev){
      var t=ev.target, st=host._st;
      if(t.hasAttribute("data-filter")){ st.q=t.value; applyFilter(host,t.value); }
      if(t.hasAttribute("data-go")){ var q=t.value.toLowerCase(); if(q.length<3) return;
        var map={quiet:"alerts",digest:"alerts",push:"alerts",cash:"rules",block:"rules",starb:"rules",watch:"watch",switch:"watch",outlook:"sources",costco:"rules",backlog:"alerts"};
        for(var k in map){ if(k.indexOf(q)===0||q.indexOf(k)===0){ st.screen=map[k]; st.q=(map[k]==="rules"&&k==="starb")?"starb":""; render(host,host._cfg); var g=host.querySelector("[data-go]"); if(g){ g.value=t.value; g.focus(); } return; } } }
    });
  }
  window.TSMock={render:render,NAVS:NAVS,glyph:glyph};
})();
