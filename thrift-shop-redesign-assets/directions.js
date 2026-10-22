/* Thrift Shop — the six directions. Each is a set of ASPECT SLOTS (nav, palette, type, rows, headers, health, hero)
   so the Blend panel can mix them. Presentation artifact, not production code. */
(function(){
  var D={};
  D.grid={
    id:"grid", name:"Price Index", seat:"Grid", designer:"Atticus Vance", movement:"Swiss / International Typographic Style",
    nav:{type:"grid", dests:[["feed","Feed",["inbox","processed"]],["rules","Rules",["gcdefaults","restaurant","retail","other","retailer","cashlike","blocked","watch","counts","overrides","also"]],["system","System",["src-summary","email","feed","direct","market","channels","timing","schedule","health","savings","bad","learned"]]]},
    fonts:"family=Archivo:wght@500;600;700&family=Inter:wght@400;500;600",
    type:{ui:"'Inter',system-ui,sans-serif",head:"'Archivo',system-ui,sans-serif",num:"'Inter',system-ui,sans-serif",fs:15,lh:1.35,hw:700},
    metrics:{row:40,u:8,r:2,ctl:1},
    palette:{
      light:{bg:"#FFFFFF",surface:"#FFFFFF",surface2:"#F4F4F4",ink:"#111111",ink2:"#5C5C5C",ink3:"#767676",line:"#E2E2E2",acc:"#E1251B",accText:"#C81E15",accInk:"#FFFFFF",accSoft:"#FDECEA",
        hOk:"#111111",hEmpty:"#8A8A8A",hBlocked:"#E1251B",hSignin:"#E1251B",hPartial:"#111111"},
      dark:{bg:"#121212",surface:"#161616",surface2:"#202020",ink:"#F2F2F2",ink2:"#A8A8A8",ink3:"#8A8A8A",line:"#2E2E2E",acc:"#FF4B3E",accText:"#FF6A5F",accInk:"#111111",accSoft:"#3A1715",
        hOk:"#F2F2F2",hEmpty:"#8A8A8A",hBlocked:"#FF4B3E",hSignin:"#FF4B3E",hPartial:"#F2F2F2"}},
    swatches:["#FFFFFF","#111111","#5C5C5C","#E2E2E2","#E1251B"],
    pitch:"A price list, not an app. Every setting is a row in one ruled index: label on the left, the value right-aligned in tabular figures, the control at the edge. Three destinations. Nothing explains itself unless you ask.",
    rationale:["Thrift Shop has become a rule book with a feed on top, so Vance treats it as typeset reference matter: a strict 8-point grid with four fixed columns (label, value, secondary value, control) that every row in every section snaps to. Sixty brands then read as one aligned table rather than sixty cards, and the eye can run straight down the % column to spot the one brand set at 15.",
     "There is one signal colour, the red of a supermarket markdown sticker, and it is used only for things that need Mark: new deals, sources that are blocked or need sign-in, and the destructive action. Everything else is black and grey. Section headers are numbered so that 'Rules 04, Warehouse' becomes an address Mark can remember, and the collapsed state of every section is kept between visits."],
    pros:["Densest scannable layout of the six: sixty brand rules fit in about four phone screens","Column alignment makes outliers jump out (a 15% rule among 20s)","Three destinations, each with an obvious job","Red is only used for problems, so a red row always means act"],
    cons:["Austere; little delight beyond the type","Four-column rows need care below 360px (the secondary value drops under the label)","Swiss red is close to the register's familiar warm accents — kept on purpose, because the markdown sticker is the product's real-world object"],
    a11y:"Body 15px Inter, ink #111 on white 18.9:1, secondary #5C5C5C 6.9:1. Red #C81E15 text 5.6:1. Health is shown by glyph shape plus a word, never colour alone. Every switch and stepper has a 44×44 hit area around a smaller visual.",
    flow:[
      ["Rules holds both gift-card rules and sale watch / email offers, eleven sections in all, so the tab is long.","Addressed: a sticky in-tab index (Gift cards, Sales, Lists) jumps to each group, sections open collapsed apart from the last one used, and the search filters every list."],
      ["A blocked source with no next step is a dead end.","Addressed: blocked and sign-in rows carry a single inline action (Reconnect, Move to browser) on their detail line."],
      ["The four-column row at 320px.","Open trade-off: below 360px the min-$ column moves under the brand name, so rows get taller there."],
      ["Destructive Delete in the feed.","Addressed: it lives in the row's More menu with undo; swipe is kept as the fast path."]],
    scores:{density:9,nav:9,read:9,config:9,aesthetics:7,a11y:8,feas:9}
  };
  D.vogue={
    id:"vogue", name:"The Bargain Edition", seat:"Vogue", designer:"Coco Belmont", movement:"Editorial / Magazine",
    nav:{type:"vogue", dests:[["feed","Today",["inbox","processed"]],["index","The Index",["src-summary","email","feed","direct","market","gcdefaults","restaurant","retail","other","retailer","cashlike","blocked","watch","counts","overrides","also","channels","timing","schedule","health","savings","bad","learned"]]]},
    fonts:"family=Bodoni+Moda:ital,opsz,wght@0,6..96,500;0,6..96,700;1,6..96,500&family=Work+Sans:wght@400;500;600",
    type:{ui:"'Work Sans',system-ui,sans-serif",head:"'Bodoni Moda',Georgia,serif",num:"'Work Sans',system-ui,sans-serif",fs:15,lh:1.4,hw:500},
    metrics:{row:46,u:10,r:0,ctl:1},
    palette:{
      light:{bg:"#FFFFFF",surface:"#FFFFFF",surface2:"#F8F2F1",ink:"#1A1A2E",ink2:"#55566B",ink3:"#76778A",line:"#E6E1E3",acc:"#2B2F7A",accText:"#2B2F7A",accInk:"#FFFFFF",accSoft:"#ECEBF7",
        hOk:"#2B2F7A",hEmpty:"#76778A",hBlocked:"#A1203A",hSignin:"#A1203A",hPartial:"#8A6A00"},
      dark:{bg:"#12131F",surface:"#171928",surface2:"#1F2235",ink:"#F3F1F4",ink2:"#B3B2C4",ink3:"#8E8FA6",line:"#2D3047",acc:"#A9AEFF",accText:"#B9BDFF",accInk:"#12131F",accSoft:"#262A52",
        hOk:"#A9AEFF",hEmpty:"#8E8FA6",hBlocked:"#FF7A93",hSignin:"#FF7A93",hPartial:"#E8C46A"}},
    swatches:["#FFFFFF","#1A1A2E","#2B2F7A","#F2CFC7","#A1203A"],
    pitch:"Each morning is an issue. The best deal is the cover story; everything else sits in 'The Index', a contents page of settings set like a menu, with dotted leaders running from each label to its value.",
    rationale:["Belmont starts from the feeling of finding a bargain, and the palette comes from a photograph of a hand-dyed indigo silk scarf with a blush lining. The top live deal becomes a full-bleed cover in Bodoni (brand, value, one line of why), and the rest of the feed reads as a short column underneath. There are two destinations because a magazine has two: the issue and its index.",
     "The Index holds every setting as a printed price list. Section titles are Bodoni italic; each row runs label, dotted leader, value, so values line up on the right edge and can be read like a menu. A contents block at the top jumps to any section, and each section folds up under its title. Help text shows up as marginalia, and only when asked for."],
    pros:["The only direction with a real emotional hook; the cover makes a good deal feel like an event","Leader rows make label-to-value reading effortless","Two destinations: the simplest nav of the six"],
    cons:["The cover costs about 40% of the first phone screen","One long Index is a lot of scrolling even with collapse; this is the least dense direction","A Bodoni display face at small sizes needs a careful minimum size (18px)"],
    a11y:"Work Sans 15px body, ink 16.4:1. Bodoni is used only at 18px and up. The cover text on indigo is 11.9:1. Leaders are decorative (aria-hidden). The contents block is a nav landmark with skip links.",
    flow:[
      ["Mark's main complaint is scrolling, and a single Index destination makes that worse.","Partly addressed: contents jump links plus collapse-all by default. Open trade-off: it is still one long page."],
      ["The cover hides the inbox count.","Addressed: the cover carries the 'N more in today's issue' count and a jump to the list."],
      ["On a quiet day the cover has nothing to show.","Addressed: it falls back to an empty-issue cover: 'No deal beat your rules today' plus when the last check ran."],
      ["Leaders compress badly with long sale-watch match text.","Addressed: watch rows drop the leader, and the match text wraps in full under the term."]],
    scores:{density:4,nav:6,read:7,config:5,aesthetics:9,a11y:7,feas:7}
  };
  D.steel={
    id:"steel", name:"Control Room", seat:"Steel", designer:"Viktor Stahl", movement:"Brutalism / Systems-first",
    nav:{type:"steel", dests:[["feed","feed",["run","inbox","processed"]],["config","config",["src-summary","email","feed","direct","market","health","gcdefaults","restaurant","retail","other","retailer","cashlike","blocked","watch","counts","overrides","also","channels","timing","schedule","savings","bad","learned"]]]},
    fonts:"family=JetBrains+Mono:wght@400;500;700&family=Chivo:wght@400;500;700",
    type:{ui:"'Chivo',system-ui,sans-serif",head:"'JetBrains Mono',ui-monospace,monospace",num:"'JetBrains Mono',ui-monospace,monospace",fs:14,lh:1.35,hw:700},
    metrics:{row:36,u:6,r:0,ctl:.95},
    palette:{
      dark:{bg:"#1C1F22",surface:"#22262A",surface2:"#2A2F34",ink:"#E8EAEC",ink2:"#A9AFB5",ink3:"#868D94",line:"#3A4046",acc:"#F5D90A",accText:"#F5D90A",accInk:"#15181B",accSoft:"#3B3816",
        hOk:"#E8EAEC",hEmpty:"#868D94",hBlocked:"#F5D90A",hSignin:"#F5D90A",hPartial:"#F5D90A"},
      light:{bg:"#E6E7E8",surface:"#F2F3F3",surface2:"#DADCDE",ink:"#15181B",ink2:"#454B51",ink3:"#5F656B",line:"#B9BDC1",acc:"#F5D90A",accText:"#5E4F00",accInk:"#15181B",accSoft:"#F7EDA0",
        hOk:"#15181B",hEmpty:"#5F656B",hBlocked:"#15181B",hSignin:"#15181B",hPartial:"#15181B"}},
    swatches:["#1C1F22","#2A2F34","#E8EAEC","#868D94","#F5D90A"],
    pitch:"The agent's own panel. A run line at the top says exactly what the last tick did; every setting is a monospace register you can jump to by typing. Two destinations and a Go box. No prose.",
    rationale:["Stahl's view is that Thrift Shop is a machine Mark operates, so the interface should show the machine. Feed opens with the raw run line (last tick, sources read, judged, alerts sent, errors) and Config opens with the source table, because 'is it working?' is the question that sits behind every other one. States are drawn as blocks: solid for blocked, outlined for sign-in, half for partial, hollow for empty. Shape carries the state, and the single hazard-yellow marks only what is wrong.",
     "There are only two destinations, plus a Go box that searches every setting label ('quiet', 'starb', 'cash') and jumps to the row, so finding a setting never depends on remembering where it lives. Headers are path-like lowercase (/sources 20, 4 need you) and collapse to one line. The banned near-black-plus-acid look is avoided by using a graphite grey rather than black, and the yellow is justified as the industrial convention for a warning state, never decoration."],
    pros:["The densest rows (36px), and the agent's state is never hidden","The Go box makes depth irrelevant, since any setting is three keystrokes away","Source health reads by shape, so it holds up for colour-blind users and in sunlight"],
    cons:["Monospace values make long sale-watch match text wider and taller","Reads as a tool, with no warmth at all","On the phone the Go box needs the keyboard, so it is slower one-handed than tapping a tab"],
    a11y:"Ink #E8EAEC on #1C1F22 is 13.6:1. Yellow is used as a fill under dark text (12.9:1), never as small text on light surfaces (#5E4F00 is used there instead). Shape-coded states have text equivalents. Go is a combobox with listbox semantics.",
    flow:[
      ["Two destinations means Config is huge.","Addressed: Go jump, collapse memory, and a pinned 'needs you' strip that lists only the rows with a problem."],
      ["The run line can read as noise on a good day.","Addressed: it shrinks to 'ok, 12 min ago' when nothing is wrong and expands only on an error."],
      ["Mono text wraps poorly in watch matches.","Addressed: match text is set in Chivo, not mono. Mono is kept for values only (and justified: values are machine state)."],
      ["Go on mobile.","Open trade-off: it needs the keyboard, though the section headers still work as tap targets."]],
    scores:{density:10,nav:7,read:7,config:8,aesthetics:6,a11y:7,feas:9}
  };
  D.calm={
    id:"calm", name:"Still Water", seat:"Calm", designer:"Anaya Shrestha", movement:"Organic / Calm-tech",
    nav:{type:"calm", dests:[["feed","Deals",["inbox","processed"]],["rules","Rules",["gcdefaults","restaurant","retail","other","retailer","cashlike","blocked","watch","counts","overrides","also"]],["settings","Settings",["src-summary","email","feed","direct","market","channels","timing","schedule","health","savings","bad","learned"]]]},
    fonts:"family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700",
    type:{ui:"'Nunito Sans',system-ui,sans-serif",head:"'Newsreader',Georgia,serif",num:"'Nunito Sans',system-ui,sans-serif",fs:16,lh:1.4,hw:600},
    metrics:{row:48,u:10,r:14,ctl:1.05},
    palette:{
      light:{bg:"#EEF1EE",surface:"#FFFFFF",surface2:"#F5F7F5",ink:"#1F2B25",ink2:"#55635B",ink3:"#6E7B74",line:"#DDE3DE",acc:"#3F6E57",accText:"#3F6E57",accInk:"#FFFFFF",accSoft:"#E1EDE6",
        hOk:"#3F6E57",hEmpty:"#84918A",hBlocked:"#8A4A5E",hSignin:"#4D6C8F",hPartial:"#8C7232"},
      dark:{bg:"#141A17",surface:"#1B2320",surface2:"#222C28",ink:"#E4EBE6",ink2:"#A5B2AA",ink3:"#86938C",line:"#2E3A35",acc:"#8DC3A6",accText:"#9BD0B3",accInk:"#141A17",accSoft:"#23362D",
        hOk:"#8DC3A6",hEmpty:"#86938C",hBlocked:"#D98AA2",hSignin:"#8FB0D6",hPartial:"#D2B56E"}},
    swatches:["#EEF1EE","#FFFFFF","#1F2B25","#3F6E57","#8A4A5E"],
    pitch:"Nothing shouts. Every section folds to a one-line summary of what it is set to ('29 brands, mostly 20%, $25 min'), so the whole configuration can be read closed. Open one only to change it.",
    rationale:["Shrestha takes 'too much to process' literally. The palette comes from river stones (cool grey-green, deep sage, a muted plum for anything wrong), and the Deals screen opens on a single still ripple that says either 'All quiet' or how many deals are waiting. There are three destinations on a labelled bottom bar.",
     "Her real move is the summary header: when a section is collapsed, its header shows its current state in words and numbers. Mark can confirm his whole setup on one screen without opening anything, and opening a section is a deliberate act. Rows are 48px soft groups with generous spacing. That calm costs density, and she owns that trade."],
    pros:["Closed sections still show their values, the strongest answer to 'too much to process'","The most forgiving and readable on a phone","Problems are named in plain words alongside their glyph"],
    cons:["Least dense once a section is open (48px rows)","Rounded grouped sheets edge towards the identical-card default; kept because the groups are sections, not one card per row","Summary text has to be generated well or it lies"],
    a11y:"16px body, ink 13.2:1, sage #3F6E57 text 5.9:1. A 48px row height over-satisfies the touch targets. Summary headers are aria-describedby on the disclosure button. Motion is a single 160ms fade, removed under reduced motion.",
    flow:[
      ["The summary header is a second source of truth that must never drift from the rows.","Addressed: summaries are computed from the same rows at render time and never stored."],
      ["Settings mixes sources with alerts.","Addressed: a sub-index at the top (Sources, Alerts, Health) with the problem count."],
      ["The ripple hero on a busy day.","Addressed: it turns into the count and pushes nothing else down."],
      ["Rows at 48px make the Restaurants section 1400px long when open.","Open trade-off: accepted. Search and collapse are the remedy."]],
    scores:{density:5,nav:8,read:9,config:7,aesthetics:8,a11y:9,feas:8}
  };
  D.neon={
    id:"neon", name:"Night Market", seat:"Neon", designer:"Mr. Neon", movement:"Glassmorphism / Futurist",
    nav:{type:"neon", dests:[["feed","Feed",["inbox","processed"]],["rules","Rules",["gcdefaults","restaurant","retail","other","retailer","cashlike","blocked","watch","counts","overrides","also"]],["sources","Sources",["src-summary","email","feed","direct","market"]],["settings","Settings",["channels","timing","schedule","health","savings","bad","learned"]]]},
    fonts:"family=Sora:wght@400;500;600;700&family=Chakra+Petch:wght@500;600",
    type:{ui:"'Sora',system-ui,sans-serif",head:"'Sora',system-ui,sans-serif",num:"'Chakra Petch',system-ui,sans-serif",fs:14,lh:1.4,hw:600},
    metrics:{row:44,u:8,r:14,ctl:1},
    palette:{
      dark:{bg:"#0B0D1A",surface:"rgba(255,255,255,.055)",surface2:"rgba(255,255,255,.10)",ink:"#EEF0FF",ink2:"#A9AED6",ink3:"#8A8FBA",line:"rgba(255,255,255,.12)",acc:"#3EE6F0",acc2:"#9A6BFF",accText:"#67EEF5",accInk:"#0B0D1A",accSoft:"rgba(62,230,240,.14)",
        hOk:"#3EE6F0",hEmpty:"#8A8FBA",hBlocked:"#FF5C8A",hSignin:"#B897FF",hPartial:"#FFC857"},
      light:{bg:"#E9ECFA",surface:"rgba(255,255,255,.72)",surface2:"rgba(255,255,255,.92)",ink:"#14163A",ink2:"#474C78",ink3:"#5F6492",line:"rgba(20,22,58,.12)",acc:"#0AA5B0",acc2:"#6B3DF0",accText:"#06737B",accInk:"#FFFFFF",accSoft:"rgba(10,165,176,.12)",
        hOk:"#06737B",hEmpty:"#5F6492",hBlocked:"#C2185B",hSignin:"#6B3DF0",hPartial:"#9A6A00"}},
    swatches:["#0B0D1A","#3EE6F0","#9A6BFF","#EEF0FF","#FF5C8A"],
    pitch:"A savings HUD. A luminous cyan-to-violet trace of money saved sits over the feed; settings float on frosted panes; source health glows as rings. The spectacle is kept to the top of the Feed, and the config panes stay solid enough to read.",
    rationale:["Mr. Neon's view is that Mark checks this app because saving money is a small thrill, so the top of the Feed is a living savings trace drawn in a cyan-to-violet gradient, with this month's figure riding the line. It is the one moment allowed to glow. A floating capsule nav holds four destinations (Feed, Rules, Sources, Settings) and stays out of the content's way.",
     "Below the hero, glass panes are tightened to 88% opacity so rows stay crisp, and numerals are set in Chakra Petch for a slight instrument feel. Source health is a ring: full for ok, hollow for empty, broken for blocked, a ring with a gap at the top for sign-in, half for partial. The gradient is used only on the hero and active states."],
    pros:["Most distinctive and screenshot-worthy","Rings give health at a glance","Four clear destinations, with Sources a first-class tab"],
    cons:["Glass over a moving background is the riskiest for contrast and performance on an older iPhone","Rows are less dense than Grid's or Steel's","The dark-first look sits near the 'near-black plus accent' default; dual-tone is the stated difference"],
    a11y:"Pane fill is 88% opaque, so the background never drops text contrast below 7:1 (ink #EEF0FF on the effective #1A1D2E). The rings carry aria-labels. The hero trace has a text summary. Reduced transparency swaps the glass for solid #161A2C.",
    flow:[
      ["Glass legibility on bright backgrounds in light mode.","Addressed: light mode uses near-opaque panes and the ink is darkened to #14163A."],
      ["The savings hero pushes the inbox down.","Addressed: it is capped at 112px and collapses to a 40px strip once Mark scrolls."],
      ["The capsule nav covers the last row.","Addressed: bottom padding equals the capsule height plus the safe area."],
      ["Ring states are subtle at 12px.","Open trade-off: the rings are drawn at 16px with a word beside them, which costs some width."]],
    scores:{density:6,nav:7,read:6,config:6,aesthetics:8,a11y:5,feas:6}
  };
  D.cup={
    id:"cup", name:"Native Ledger", seat:"Cupertino", designer:"Nils Brunner", movement:"Apple HIG / iOS-native",
    nav:{type:"cup", dests:[["feed","Feed",["inbox","processed"]],["rules","Rules",["seg"]],["sources","Sources",["src-summary","email","feed","direct","market"]],["settings","Settings",["channels","timing","schedule","health","savings","bad","learned"]]],
      seg:[["Gift cards",["gcdefaults","restaurant","retail","other","retailer","cashlike","blocked"]],["Sales & offers",["watch","counts","overrides","also"]]]},
    fonts:"family=Figtree:wght@400;500;600;700",
    type:{ui:"system-ui,-apple-system,'SF Pro Text','Figtree',sans-serif",head:"system-ui,-apple-system,'SF Pro Display','Figtree',sans-serif",num:"system-ui,-apple-system,'SF Pro Text','Figtree',sans-serif",fs:15,lh:1.33,hw:600},
    metrics:{row:44,u:8,r:10,ctl:1},
    palette:{
      light:{bg:"#F2F2F7",surface:"#FFFFFF",surface2:"#F2F2F7",ink:"#000000",ink2:"#6C6C70",ink3:"#6C6C70",line:"#D1D1D6",acc:"#007AFF",accText:"#0062CC",accInk:"#FFFFFF",accSoft:"#E5F0FF",
        hOk:"#34C759",hEmpty:"#8E8E93",hBlocked:"#FF3B30",hSignin:"#FF9500",hPartial:"#FFCC00"},
      dark:{bg:"#000000",surface:"#1C1C1E",surface2:"#2C2C2E",ink:"#FFFFFF",ink2:"#98989F",ink3:"#8D8D93",line:"#38383A",acc:"#0A84FF",accText:"#409CFF",accInk:"#FFFFFF",accSoft:"#0A2A4D",
        hOk:"#30D158",hEmpty:"#8E8E93",hBlocked:"#FF453A",hSignin:"#FF9F0A",hPartial:"#FFD60A"}},
    swatches:["#F2F2F7","#FFFFFF","#007AFF","#34C759","#FF3B30"],
    pitch:"It should feel like the Settings app Apple would ship for Thrift Shop. Grouped inset lists, a four-tab bar, collapsible section headers like the Files sidebar, system colours with SF-style status symbols, adaptive light and dark.",
    rationale:["Brunner's point is that Mark already knows how to operate iOS Settings, which is itself a deep, dense configuration tree. So Thrift Shop borrows its grammar: grouped inset sections, a value right-aligned in secondary label colour, a chevron for anything deeper, and a standard tab bar with four destinations. Rules uses a segmented control (Gift cards, Sales & offers) so the two halves of the rule book never share a scroll.",
     "Rows are compact (44px, subheadline 15pt rather than body 17pt; that is a deliberate break from HIG because the content is dense configuration). Section headers carry a disclosure chevron and remember their state, as iOS 17 sidebar sections do. Source health uses SF-Symbol-style glyphs in system colours: checkmark, dashed circle, octagon, person badge, half circle. The look adapts to the system appearance with no extra work, and no conventions are broken without cause."],
    pros:["Zero learning curve on an iPhone; it is the house Mark already lives in","Adaptive light and dark come for free with system colours","Segmented Rules splits the longest list in two"],
    cons:["Less dense than Grid: iOS cells carry more padding and separators","Looks like 'just Settings', with no identity of its own","A web page imitating iOS can fall into the uncanny valley if the details slip"],
    a11y:"System colours with text-safe variants (#0062CC links 5.6:1). Dynamic-type-like scaling via rem. Switches are standard 51×31. Symbols carry labels. Respects prefers-color-scheme and prefers-reduced-motion natively.",
    flow:[
      ["Sale watch two levels deep (Rules, then Sales & offers) hides the thing Mark checks most.","Addressed: the segment is remembered, and a watch match also surfaces in the Feed."],
      ["Four tabs plus a segment is five places.","Open trade-off: it is still within the HIG's five-tab ceiling, and each place has one job."],
      ["iOS switches at 51×31 read large for Mark's 'large buttons' complaint.","Addressed: the switch is the platform standard, while steppers and segmented controls use the compact 28pt visual inside a 44pt hit area."],
      ["Destructive actions.","Addressed: swipe actions and a context menu, with confirmation only for Delete."]],
    scores:{density:7,nav:9,read:8,config:9,aesthetics:7,a11y:9,feas:9}
  };
  window.TS_DIRS=D;
  window.TS_ORDER=["grid","vogue","steel","calm","neon","cup"];
  window.TS_WEIGHTS=[["density","Density & scannability",25],["nav","Navigation clarity",20],["read","Readability of key values",20],["config","Config ergonomics",15],["aesthetics","Aesthetics",10],["a11y","Accessibility",5],["feas","Feasibility (vanilla HTML/CSS/JS)",5]];
})();
