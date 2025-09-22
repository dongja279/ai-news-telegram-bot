import { XMLParser } from 'fast-xml-parser';
export type Market='KOSDAQ'|'NASDAQ';
export type Cat='rates'|'fx_bonds'|'energy'|'geopolitics'|'bigtech_ai'|'system_risk'|'regulation_policy'|'mna_earnings';

const en:Record<Cat,string>={
  rates:'(Fed OR CPI OR PCE OR jobs) stock',
  fx_bonds:'("10-year Treasury" OR DXY OR Dollar Index)',
  energy:'(WTI OR Brent OR OPEC+)',
  geopolitics:'(war OR sanctions OR blockade OR Middle East OR Taiwan)',
  bigtech_ai:'(AI chips OR Nvidia OR cloud OR big tech)',
  system_risk:'(bank failure OR liquidity crisis OR high yield)',
  regulation_policy:'(antitrust OR export controls OR subsidy)',
  mna_earnings:'(earnings OR guidance OR M&A OR bankruptcy)'
};
const ko:Record<Cat,string>={
  rates:'(연준 OR 금리 OR CPI OR PCE OR 고용지표)',
  fx_bonds:'(미국10년물 OR 달러인덱스 OR 환율)',
  energy:'(WTI OR 브렌트 OR OPEC)',
  geopolitics:'(전쟁 OR 제재 OR 중동 OR 대만 해협)',
  bigtech_ai:'(AI 칩 OR 엔비디아 OR 클라우드 OR 빅테크)',
  system_risk:'(은행 파산 OR 유동성 위기 OR 하이일드)',
  regulation_policy:'(반독점 OR 수출통제 OR 보조금)',
  mna_earnings:'(실적 발표 OR 가이던스 OR 인수합병 OR 파산)'
};

export async function fetchTopNews(market:Market,cats:Cat[],limit=10){
  const parser=new XMLParser({ignoreAttributes:true});
  const urls=cats.map(cat=>{
    const q=market==='NASDAQ'?en[cat]:ko[cat];
    const base='https://news.google.com/rss/search';
    const hl=market==='NASDAQ'?'en-US':'ko-KR', gl=market==='NASDAQ'?'US':'KR';
    return `${base}?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl.split('-')[0]}`;
  });
  const items:{title:string;link:string;pubDate:number;cat:Cat}[]=[];
  for(let i=0;i<urls.length;i++){
    const res=await fetch(urls[i],{headers:{'User-Agent':'Mozilla/5.0'}});
    const xml=await res.text(); const j=parser.parse(xml);
    const list=Array.isArray(j?.rss?.channel?.item)?j.rss.channel.item:(j?.rss?.channel?.item?[j.rss.channel.item]:[]);
    const cat=cats[i]??cats[0];
    for(const it of list){
      if(!it?.title||!it?.link) continue;
      const t=String(it.title).replace(/<[^>]*>/g,'').trim();
      const l=String(it.link).trim();
      const d=Date.parse(String(it.pubDate||Date.now()));
      items.push({title:t,link:l,pubDate:isNaN(d)?Date.now():d,cat});
    }
  }
  const uniq=new Map<string,typeof items[number]>();
  items.sort((a,b)=>b.pubDate-a.pubDate);
  for(const it of items){ if(!uniq.has(it.title)) uniq.set(it.title,it); }
  return Array.from(uniq.values()).slice(0,limit);
}

export function beneficiaries(market:Market,cats:Cat[]){
  const map:Record<Cat,{sectors:string[];us?:string[];kr?:string[];note?:string}>={
    rates:{sectors:['금융','주택/리츠'],us:['XLF','MS','ITB'],kr:['KB금융','신한지주'],note:'금리상승=은행 유리, 하락=주택/리츠 유리'},
    fx_bonds:{sectors:['수출','원자재'],us:['DXY','HYG'],kr:['삼성전자','포스코퓨처엠']},
    energy:{sectors:['에너지','운송'],us:['XLE','CVX','SLB'],kr:['S-Oil','HMM']},
    geopolitics:{sectors:['방산','에너지','공급망'],us:['LMT','NOC'],kr:['한화에어로','LIG넥스원']},
    bigtech_ai:{sectors:['반도체','클라우드','빅테크'],us:['NVDA','AMD','MSFT','META'],kr:['삼성전자','SK하이닉스']},
    system_risk:{sectors:['은행','하이일드'],us:['XLF','HYG'],kr:['KB금융']},
    regulation_policy:{sectors:['정책영향 업종'],us:['XLK','TSLA','META'],kr:['2차전지 ETF']},
    mna_earnings:{sectors:['실적 민감'],us:['QQQ','SOXX'],kr:['TIGER반도체']}
  };
  const arr=cats.map(c=>map[c]);
  const U=<T,>(x:T[]|undefined)=>Array.from(new Set(x||[]));
  return {sectors:U(arr.flatMap(x=>x?.sectors)),tickersUS:U(arr.flatMap(x=>x?.us||[])),tickersKR:U(arr.flatMap(x=>x?.kr||[])),note:arr.map(x=>x?.note).filter(Boolean).join('; ')};
}

export function formatDigestHTML(dateLabel:string,market:Market,cats:Cat[],items:Awaited<ReturnType<typeof fetchTopNews>>,b:any){
  const news=items.map((it,i)=>`${i+1}. <a href="${it.link}">${escapeHtml(it.title)}</a>`).join('<br/>');
  const ben=market==='NASDAQ'?`<b>추천(미국):</b> ${b.tickersUS.join(', ')}`:`<b>추천(한국):</b> ${b.tickersKR.join(', ')}`;
  return [`<b>[${dateLabel}] ${market} · ${cats.join(', ')}</b>`,news,`<b>수혜 섹터:</b> ${b.sectors.join(', ')}`,ben,b.note?`<i>${b.note}</i>`:''].filter(Boolean).join('<br/><br/>');
}
function escapeHtml(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
