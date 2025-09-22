export type Order={side:'BUY'|'SELL'|'STOP';price:number;size:number;reason:string};
type Candle={t:number;o:number;h:number;l:number;c:number};

async function candles(symbol:string,limit=200){
  const now=Math.floor(Date.now()/1000),from=now-86400*400;
  const url=`https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${now}&token=${process.env.FINNHUB_API_KEY}`;
  const r=await fetch(url); const j:any=await r.json();
  if(j.s!=='ok') return [] as Candle[];
  return j.t.map((t:number,i:number)=>({t,o:j.o[i],h:j.h[i],l:j.l[i],c:j.c[i]})).slice(-limit);
}
function ema(v:number[],n:number){const k=2/(n+1);let e=v[0];return v.map((x,i)=>i?(e=x*k+e*(1-k)):e);}
function atr(cs:Candle[],n=14){const tr:number[]=[];for(let i=0;i<cs.length;i++){const c=cs[i],pc=i?cs[i-1].c:c.c;tr.push(Math.max(c.h-c.l,Math.abs(c.h-pc),Math.abs(c.l-pc)));}const a:number[]=[];let s=0;for(let i=0;i<tr.length;i++){if(i<n){s+=tr[i];a.push(s/(i+1));}else{a.push((a[i-1]*(n-1)+tr[i])/n);} }return a;}
const R=(x:number)=>Math.round(x*100)/100;

export async function advise(symbol:string,qty:number,avg:number){
  const cs=await candles(symbol.toUpperCase()); if(!cs.length) return {text:`데이터 없음: ${symbol}`,orders:[] as Order[]};
  const closes=cs.map(c=>c.c); const E=ema(closes,20).at(-1)!; const A=atr(cs,14).at(-1)!; const last=closes.at(-1)!;
  const k=0.6; const buy1=Math.min(E,last)-k*A, buy2=buy1-0.8*A, tp=(avg>0?avg*1.07:last*1.06), sl=last-2.8*A;
  const s1=Math.max(1,Math.round(qty*0.4)), s2=Math.max(1,Math.round(qty*0.3));
  const orders:Order[]=[{side:'BUY',price:R(buy1),size:s1,reason:'EMA20/ATR 진입1'},{side:'BUY',price:R(buy2),size:s2,reason:'ATR 추가매수'},{side:'SELL',price:R(tp),size:s1,reason:'익절'},{side:'STOP',price:R(sl),size:Math.max(1,Math.round(qty)),reason:'손절(≈2.8*ATR)'}];
  const opinion=last<E?'지금은 추가 매수 신중':'추가 매수 가능 구간 대기';
  return {text:`${symbol} 전략\nEMA20=${E.toFixed(2)} ATR14=${A.toFixed(2)} Last=${last.toFixed(2)}\n의견: ${opinion}`,orders};
}
