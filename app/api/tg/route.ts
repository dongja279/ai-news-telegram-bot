import { NextRequest, NextResponse } from 'next/server';
import { fetchTopNews, beneficiaries, formatDigestHTML, Market, Cat } from '@/lib/news';
import { advise } from '@/lib/strategy';

const DEF_MKT = (process.env.DEFAULT_MARKET||'NASDAQ') as Market;
const DEF_CATS = (process.env.DEFAULT_CATS||'rates,fx_bonds,bigtech_ai,energy,geopolitics')
  .split(',').map(s=>s.trim()).filter(Boolean) as Cat[];

async function send(chat_id:number|string, html:string){
  const url=`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url,{ method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ chat_id, text: html, parse_mode:'HTML', disable_web_page_preview:true }) });
}

function parseCats(s?:string): Cat[]{
  const allow:Cat[]=['rates','fx_bonds','energy','geopolitics','bigtech_ai','system_risk','regulation_policy','mna_earnings'];
  const m=(s||'').split(/[,\s]+/).map(x=>x.trim()).filter(Boolean) as Cat[];
  return m.length? m.filter(x=>allow.includes(x)) : DEF_CATS;
}

export async function POST(req: NextRequest){
  const b=await req.json();
  const msg=b.message?.text||''; const chatId=b.message?.chat?.id;
  if(!chatId) return NextResponse.json({ok:true});
  const [cmd,...rest]=msg.trim().split(/\s+/);

  if(cmd==='/start'||cmd==='/help'){
    await send(chatId, `디폴트: ${DEF_MKT} · ${DEF_CATS.join(', ')}\n/daily [시장] [카테고리들]\n예) /daily NASDAQ rates,bigtech_ai\n/signal <티커> <수량> <평단>\n(참고) chat_id=${chatId}`);
    return NextResponse.json({ok:true});
  }

  if(cmd==='/daily'){
    const mkt = (rest[0]||DEF_MKT).toUpperCase()==='KOSDAQ'?'KOSDAQ':'NASDAQ';
    const cats = parseCats(rest.slice(1).join(' '));
    const items = await fetchTopNews(mkt as Market, cats, 10);
    const ben = beneficiaries(mkt as Market, cats);
    const html = formatDigestHTML(new Date(Date.now()-24*3600*1000).toISOString().slice(0,10), mkt as Market, cats, items, ben);
    await send(chatId, html);
    return NextResponse.json({ok:true});
  }

  if(cmd==='/signal' && rest.length>=3){
    const sym=rest[0].toUpperCase(), qty=Number(rest[1]||'1'), avg=Number(rest[2]||'0');
    const r=await advise(sym, qty, avg);
    const lines=r.orders.map(o=>`${o.side} ${o.size} @ ${o.price} (${o.reason})`).join('\n');
    await send(chatId, `${r.text}\n${lines}`.replace(/&/g,'&amp;'));
    return NextResponse.json({ok:true});
  }

  await send(chatId, '명령어: /daily [시장] [카테고리들], /signal 티커 수량 평단, /help');
  return NextResponse.json({ok:true});
}

export async function GET(){ return NextResponse.json({ ok:true, hint:'Set Telegram webhook to this endpoint.' }); }
