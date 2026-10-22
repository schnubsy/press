/* Thrift Shop — Eye review mock data (presentation artifact, not production).
   Functional inventory taken from docs/spec.md + thrift-shop.html labels/controls. */
(function(){
  // Load the alignment pins (engine-align.css) next to engine.css on every page that uses the mock.
  try{ var s=document.currentScript&&document.currentScript.src; if(s){ var l=document.createElement("link"); l.rel="stylesheet"; l.href=s.replace(/data\.js(\?.*)?$/,"engine-align.css?v=4"); document.head.appendChild(l); } }catch(e){}
  var R=[ // [brand, group, min_pct, min_denom, on, mode]
    ["BJ's","restaurant"],["Burger King","restaurant"],["Cheesecake Factory","restaurant"],["Chipotle","restaurant"],["Dickey's","restaurant"],
    ["DoorDash","restaurant"],["Dunkin'","restaurant"],["Fogo de Chao","restaurant"],["Grimaldi's","restaurant"],["Gringo's","restaurant"],
    ["IHOP","restaurant"],["In-N-Out","restaurant"],["Jimmy John's","restaurant"],["KFC","restaurant"],["Krispy Kreme","restaurant"],
    ["Landry's","restaurant"],["McDonald's","restaurant"],["Panera","restaurant"],["Papa John's","restaurant"],["Pappasito's","restaurant"],
    ["Schlotzsky's","restaurant"],["Shake Shack","restaurant"],["Sonic","restaurant"],["Starbucks","restaurant",15,10],["Subway","restaurant"],
    ["Taco Bell","restaurant"],["Wendy's","restaurant"],["Which Wich","restaurant"],["Wings 'N More","restaurant"],
    ["Ace Hardware","retail"],["Amazon","retail",10,50],["Barnes & Noble","retail"],["Bath & Body Works","retail"],["GAP","retail"],
    ["Home Depot","retail",15,100],["Lowe's","retail",15,100],["Lululemon","retail"],["Nordstrom","retail"],["Sentinel Vinyl","retail"],
    ["Sephora","retail"],["Sunday Citizen","retail"],["Total Wine","retail",10,25],["Walmart","retail",10,50],["Wayfair","retail"],["Woodcraft","retail"],
    ["1Password","other"],["Airbnb","other",15,100],["AMC","other"],["Apple","other",10,25],["Elements Massage","other"],["Fandango","other"],
    ["Hotels.com","other"],["Jiffy Lube","other"],["Main Event","other"],["Marriott","other"],["Topgolf","other"],["Uber","other"],
    ["Xbox / Microsoft","other"],["Zift","other"],["Skype","other",20,25,false],
    ["Costco","retailer",null,null,true,"stack"],["Sam's Club","retailer",null,null,true,"stack"],["HEB","retailer",null,null,true,"booster"]
  ];
  var rules=R.map(function(r,i){ return {id:"r"+i,brand:r[0],group:r[1],pct:r[2]==null?20:r[2],denom:r[3]==null?25:r[3],on:r[4]!==false,mode:r[5]||"pct"}; });

  window.TS_DATA={
    now:"Wed 22 Oct, 9:41",
    deals:[
      {id:"d1",kind:"card",brand:"DoorDash",badge:"20%",verdict:"hit",isNew:true,line:"$100 card for $80 + $20 Target card",where:"Target",src:"Slickdeals",when:"18 min",exp:"Oct 26"},
      {id:"d2",kind:"offer",brand:"Chipotle",badge:"Free",verdict:"hit",isNew:true,line:"Free entrée with any entrée purchase — rewards members, in app or online",where:"Email",src:"Outlook",when:"1 h",exp:"Tomorrow",soon:true},
      {id:"d3",kind:"sale",brand:"Nintendo Switch 2",badge:"10%",verdict:"hit",isNew:true,line:"Nintendo Switch 2 + Mario Kart World Bundle — $449.99 (was $499.99), free shipping",where:"Target",src:"Watch",when:"3 h"},
      {id:"d4",kind:"card",brand:"Home Depot",badge:"20%",verdict:"hit",line:"$200 for $159.99 — $10 off stacks on the member price",where:"Sam's Club",src:"Store check",when:"Wed",exp:"Nov 2"},
      {id:"d5",kind:"offer",brand:"Starbucks",badge:"$10",verdict:"hit",line:"Your 150 Stars ($10 reward) expire Oct 31",where:"Email",src:"Outlook",when:"5 h",exp:"9 days"},
      {id:"d6",kind:"card",brand:"Cheesecake Factory",badge:"20%",verdict:"hit",line:"$100 card + $25 bonus card — judged on the total",where:"Cheesecake Factory",src:"Doctor of Credit",when:"Yesterday",exp:"Dec 31"},
      {id:"d7",kind:"card",brand:"Apple",badge:"7%",verdict:"near",line:"$100 for $93 — below your 10% rule",where:"PayPal Digital Gifts",src:"GC Galore",when:"Yesterday"},
      {id:"d8",kind:"offer",brand:"Panera",badge:"20%",verdict:"near",line:"$5 off $25 — below your 40% bar",where:"Email",src:"Outlook",when:"2 d",exp:"Oct 28"}
    ],
    processed:[
      {id:"p1",kind:"card",brand:"Uber",badge:"20%",verdict:"hit",line:"$100 for $80",where:"Costco",src:"Store check",when:"6 d",status:"Bought",saved:"$20"},
      {id:"p2",kind:"offer",brand:"Burger King",badge:"$3",verdict:"near",line:"Whopper $3.98 Wednesdays",where:"Email",src:"Outlook",when:"7 d",status:"Bad"},
      {id:"p3",kind:"card",brand:"Sephora",badge:"15%",verdict:"near",line:"$50 for $42.50",where:"Kroger",src:"Frequent Miler",when:"9 d",status:"Skipped"}
    ],
    rules:rules,
    defaults:{pct:20,denom:25},
    cashLike:["HEB","Amazon","Walmart","Target","Costco","Kroger"],
    blocked:["Dollar General","Pink","BJ's Wholesale"],
    offerTypes:[
      {id:"free_meal",label:"Free meal or entrée",on:true},
      {id:"bogo_free",label:"Buy one, get one free",on:true},
      {id:"expiring_reward",label:"Expiring reward",on:true,val:"7 days",opts:["3 days","7 days","14 days","30 days"],vlabel:"within"},
      {id:"dollar_off",label:"$ off, no or low minimum",on:true,val:"$10",opts:["$5","$10","$15","$20","$25"],vlabel:"min"},
      {id:"pct_off",label:"Big % off",on:true,val:"40%",opts:["25%","30%","35%","40%","50%","60%"],vlabel:"min"},
      {id:"birthday_reward",label:"Birthday reward",on:true,val:"Your birthday",opts:["Your birthday"],vlabel:"date"},
      {id:"bonus_gift_card",label:"Bonus gift card with purchase",on:true,val:"Gift-card rules",vlabel:"judged by"},
      {id:"free_small_item",label:"Free drink, side or dessert",on:false}
    ],
    brandOverrides:[{brand:"Chipotle",mode:"Always"},{brand:"Burger King",mode:"Never"},{brand:"Domino's",mode:"Never"}],
    alsoCount:"Free car wash with any purchase",
    watches:[
      {id:"w1",term:"Nintendo Switch 2",min:"≥10%",on:true,state:"match",match:"Nintendo Switch 2 + Mario Kart World Bundle — $449.99 (was $499.99) at Target, free shipping",when:"3 h ago",n:4},
      {id:"w2",term:"LG C4 65 inch OLED",min:"≥20%",on:true,state:"match",match:"LG 65-inch Class OLED evo C4 Series 4K Smart TV OLED65C4PUA — $1,496.99 (was $2,699.99) at Amazon",when:"1 d ago",n:2},
      {id:"w3",term:"Sonos Era 100",min:"Any",on:true,state:"match",match:"Sonos Era 100 Smart Speaker, 2nd gen, Black — $179 open-box (excellent) at Best Buy",when:"2 d ago",n:1},
      {id:"w4",term:"Weber Spirit E-325",min:"≥15%",on:true,state:"none",match:"No matches in 30 days",n:0},
      {id:"w5",term:"AirPods Pro 3",min:"Any",on:true,state:"new",match:"Not yet checked — first search at noon",n:0},
      {id:"w6",term:"Dyson V15 Detect",min:"≥25%",on:false,state:"paused",match:"Paused — not searched",n:0}
    ],
    /* health: ok | empty | blocked | signin | partial | off */
    sources:[
      {g:"email",name:"Outlook offers",h:"signin",lane:"Email",cad:"2× a day",last:"3 d ago",detail:"Sign-in expired — reconnect to resume reading the offers folder",action:"Reconnect",on:true},
      {g:"feed",name:"Slickdeals",h:"ok",lane:"Cloud",cad:"3× a day",last:"12 min ago",detail:"14 items read, 2 matched",on:true},
      {g:"feed",name:"Doctor of Credit",h:"ok",lane:"Cloud",cad:"3× a day",last:"12 min ago",detail:"6 items read, 1 matched",on:true},
      {g:"feed",name:"GC Galore",h:"ok",lane:"Cloud",cad:"3× a day",last:"12 min ago",detail:"9 items read",on:true},
      {g:"feed",name:"Frequent Miler",h:"empty",lane:"Cloud",cad:"3× a day",last:"12 min ago",detail:"Fetched fine — nothing new since Monday",on:true},
      {g:"feed",name:"DealNews gift cards",h:"partial",lane:"Cloud",cad:"3× a day",last:"12 min ago",detail:"2 of 3 pages read — page 3 timed out",on:true},
      {g:"feed",name:"r/giftcarddeals",h:"blocked",lane:"Cloud",cad:"3× a day",last:"2 d ago",detail:"403 to a server fetch, 3 times — move to the browser lane",action:"Move to browser",on:true},
      {g:"direct",name:"Costco",h:"ok",lane:"Browser",cad:"Weekly, Wed",last:"Today 7:02",detail:"11 cards read",on:true},
      {g:"direct",name:"Sam's Club",h:"ok",lane:"Browser",cad:"Weekly, Wed",last:"Today 7:06",detail:"8 cards read, 1 stack",on:true},
      {g:"direct",name:"HEB",h:"partial",lane:"Browser",cad:"Weekly, Wed",last:"Today 7:11",detail:"Coupons read, gift-card aisle did not load",on:true},
      {g:"direct",name:"Kroger",h:"empty",lane:"Browser",cad:"3× a day",last:"7:15",detail:"Page loaded — no gift-card promos listed",on:true},
      {g:"direct",name:"Target",h:"ok",lane:"Browser",cad:"3× a day",last:"7:18",detail:"5 promos read",on:true},
      {g:"direct",name:"Best Buy",h:"blocked",lane:"Browser",cad:"3× a day",last:"Mon",detail:"CAPTCHA wall — never solved, source paused",on:true},
      {g:"direct",name:"Amazon",h:"empty",lane:"Cloud",cad:"3× a day",last:"12 min ago",detail:"No gift-card promos today",on:true},
      {g:"direct",name:"PayPal Digital Gifts",h:"ok",lane:"Cloud",cad:"3× a day",last:"12 min ago",detail:"22 cards read",on:true},
      {g:"direct",name:"Apple",h:"off",lane:"Cloud",cad:"1× a day",last:"—",detail:"Turned off",on:false},
      {g:"market",name:"Raise",h:"ok",lane:"Cloud",cad:"3× a day",last:"12 min ago",detail:"40 listings read",on:true},
      {g:"market",name:"CardCash",h:"partial",lane:"Cloud",cad:"3× a day",last:"12 min ago",detail:"Prices read, stock levels missing",on:true},
      {g:"market",name:"Gift Card Granny",h:"blocked",lane:"Cloud",cad:"3× a day",last:"4 d ago",detail:"Bot wall to a server fetch",action:"Move to browser",on:true},
      {g:"market",name:"CardBear",h:"empty",lane:"Cloud",cad:"1× a day",last:"7:00",detail:"Fetched — no listings above your rules",on:true}
    ],
    alerts:{push:true,pushHealth:"Last push OK, 2 h ago",email:true,mode:"Instant",digest:true,digestTime:"7:30 am",quiet:true,quietFrom:"10:00 pm",quietTo:"7:00 am",
      feedCad:"3× a day",offerCad:"2× a day",weeklyDay:"Wednesday",minCard:"$25"},
    health:{backlog:"0 waiting",backlogLevel:"ok",lastRun:"12 min ago",outlook:"Sign-in needed",judging:"94% on the golden set, last run Oct 20"},
    metrics:{total:"$1,284",month:"$96",used:41,skipped:63,alerts:17,rate:"39%",tooGood:1,byKind:[["Gift cards","$1,102"],["Sales","$50"],["Offers","$132"]],
      spark:[12,30,22,48,40,64,58,80,72,96]},
    bad:[{brand:"Panera",kind:"offer",reason:"Below my rule",when:"2 d"},{brand:"Burger King",kind:"offer",reason:"Not significant",when:"7 d"},{brand:"Visa multi-brand",kind:"card",reason:"Price missing",when:"8 d",auto:true}],
    learned:16
  };
})();
