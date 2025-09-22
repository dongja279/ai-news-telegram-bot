import { NextResponse } from 'next/server';
import { fetchTopNews, beneficiaries, formatDigestHTML, Market, Cat } from '@/lib/news';

export async function GET(){
  const chatId=process.env.TELEGRAM_CHAT_ID!;
  const market=(process.env.DEFAULT_MARKET||'NASDAQ') as Market;
  const cats=(process.env.DEFAULT_CATS||'rates,fx_bonds,bigtech_ai,energy,geopolitics').split(',').map(s=>s.trim()) as Cat[];
  const items=await fetchTopNews(market, cats, 10);
  const ben=beneficiaries(market, cats);
  const html=formatDigestHTML(new Date(Date.now()-24*3600*1000).toISOString().slice(0,10), market, cats, items, ben);
  const url=`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text:html,parse_mode:'HTML',disable_web_page_preview:true})});
  return NextResponse.json({ok:true});
}
