"use client";

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowDown,ArrowUpRight,Check,FileSpreadsheet,Package,ReceiptText,Wallet} from 'lucide-react';

const phases=[{en:'Start with the whole picture.',hi:'पहले पूरा हिसाब देखें।',detail:'Orders. Settlements. The details in between.',detailHi:'ऑर्डर, सेटलमेंट और बीच का हर हिसाब।'}, {en:'Give every deduction a place.',hi:'हर कटौती का हिसाब रखें।',detail:'Separate fees, returns and money still pending.',detailHi:'फ़ीस, रिटर्न और बाकी भुगतान अलग देखें।'}, {en:'See what you actually keep.',hi:'जानें, आपके लिए कितना बचा।',detail:'Add your costs. Find your contribution.',detailHi:'अपनी लागत जोड़ें। बची हुई कमाई जानें।'}];
const rows=[{id:'orders',label:'Order value',hi:'ऑर्डर की राशि',amount:'₹1,28,000',icon:Package},{id:'fees',label:'Marketplace fees',hi:'मार्केटप्लेस फ़ीस',amount:'− ₹18,000',icon:ReceiptText},{id:'returns',label:'Return adjustments',hi:'रिटर्न समायोजन',amount:'− ₹8,000',icon:ReceiptText}];

export function ProfitLedger({stage=2,english=true,hero=false}:{stage?:number;english?:boolean;hero?:boolean}){
 return <div className={`profit-ledger ledger-stage-${stage}${hero?' ledger-hero':''}`}>
  <div className="ledger-top"><span><span className="ledger-logo" aria-hidden="true"><FileSpreadsheet size={17}/></span>{english?'Your money, reconciled':'आपकी कमाई का हिसाब'}</span><span className="ledger-period">SEP 2026</span></div>
  <div className="ledger-total"><span>{stage===0?(english?'Order value':'ऑर्डर की राशि'):stage===1?(english?'Expected settlement':'अपेक्षित सेटलमेंट'):(english?'Observed contribution':'लागत के बाद योगदान')}</span><strong>{stage===0?'₹1,28,000':stage===1?'₹1,02,000':'₹30,000'}<span className="ledger-total-dot"/></strong><small>{english?'Illustrative example · not live seller data':'उदाहरण · वास्तविक विक्रेता का डेटा नहीं'}</small></div>
  <div className="ledger-rows">{rows.map(({id,label,hi,amount,icon:Icon},i)=><div key={id} className={`ledger-row row-${id}`} style={{'--row':i} as React.CSSProperties}><span className="ledger-row-icon"><Icon size={16}/></span><span>{english?label:hi}</span><strong>{amount}</strong></div>)}
  <div className="ledger-row row-costs"><span className="ledger-row-icon"><Package size={16}/></span><span>{english?'Goods + packing + ads':'माल + पैकिंग + विज्ञापन'}</span><strong>− ₹72,000</strong></div></div>
  <div className="ledger-cash"><span><Wallet size={16}/>{english?'Bank received':'बैंक में मिला'}<strong>₹90,000</strong></span><span>{english?'Pending settlement':'बाकी सेटलमेंट'}<strong>₹12,000</strong></span></div>
  <div className="ledger-bottom"><span><Check size={14}/>{english?'Every amount has a source':'हर राशि का अपना स्रोत'}</span><span>{english?'Costs included in this example':'इस उदाहरण में लागत शामिल है'}</span></div>
 </div>;
}

export function WebsiteJourney({english}:{english:boolean}){
 const section=useRef<HTMLElement>(null);const [stage,setStage]=useState(0);
 useEffect(()=>{
  const element=section.current;if(!element)return;const media=window.matchMedia('(min-width: 900px) and (prefers-reduced-motion: no-preference)');let visible=false,raf=0;
  const draw=()=>{raf=0;if(!media.matches||!visible)return;const rect=element.getBoundingClientRect();const progress=Math.max(0,Math.min(1,-rect.top/Math.max(1,rect.height-window.innerHeight)));element.style.setProperty('--journey-progress',String(progress));setStage(old=>{const next=Math.min(2,Math.floor(progress*3));return old===next?old:next;});};
  const schedule=()=>{if(!raf&&visible&&media.matches)raf=requestAnimationFrame(draw);};const resize=()=>{element.dataset.motion=media.matches?'scroll':'static';schedule();};
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;schedule();},{rootMargin:'100px'});observer.observe(element);resize();window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',resize);media.addEventListener('change',resize);
  return()=>{observer.disconnect();cancelAnimationFrame(raf);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',resize);media.removeEventListener('change',resize);};
 },[]);
 return <section ref={section} className="website-journey" id="money-journey" aria-label={english?'From sales to contribution':'बिक्री से योगदान तक'}><div className="journey-sticky website-container"><div className="journey-copy"><p className="website-eyebrow">{english?'FOLLOW THE MONEY':'पैसे का सफ़र'}</p><div className="journey-steps">{phases.map((phase,i)=><div key={phase.en} className="journey-step" data-active={stage===i}><span className="journey-step-number">0{i+1}</span><h2>{english?phase.en:phase.hi}</h2><p>{english?phase.detail:phase.detailHi}</p></div>)}</div><Link href="/methodology" className="website-text-link">{english?'See the calculation method':'गणना का तरीका देखें'}<ArrowUpRight size={17}/></Link></div><div className="journey-visual" aria-hidden="true"><ProfitLedger stage={stage} english={english}/><div className="journey-progress"><span/><span/><span/></div><p><ArrowDown size={14}/>{english?'One report. A clearer decision.':'एक रिपोर्ट। साफ़ निर्णय।'}</p></div><div className="journey-static-ledger"><ProfitLedger stage={2} english={english}/></div></div></section>;
}
