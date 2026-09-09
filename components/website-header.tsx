"use client";

import {useSyncExternalStore} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {ArrowUpRight} from 'lucide-react';
import {Brand} from './brand';
import {useAccountStatus, useLanguage, useSiteSettings} from './providers';

const subscribeHydration = () => () => {};
const hydratedSnapshot = () => true;
const serverSnapshot = () => false;

export function WebsiteHeader(){
 const ready=useSyncExternalStore(subscribeHydration, hydratedSnapshot, serverSnapshot);
 const pathname=usePathname();const {language,setLanguage}=useLanguage();const {user}=useAccountStatus();const {settings}=useSiteSettings();const english=language==='english';
 const links=[{href:'/analyze',label:english?'Profit Check':'लाभ देखें'},{href:'/marketplaces',label:english?'Marketplaces':'मार्केटप्लेस'},...(settings.navigation.showCalculators?[{href:'/calculators',label:english?'Calculators':'कैलकुलेटर'}]:[]),{href:'/blog',label:english?'Journal':'जर्नल'},...(settings.navigation.showPricing?[{href:'/pricing',label:english?'Pricing':'प्लान'}]:[])];
 const navLinks=links.map(link=><Link key={link.href} href={link.href} aria-current={pathname===link.href||pathname?.startsWith(link.href+'/')?'page':undefined}>{link.label}</Link>);
 return <header className="website-header" lang={english?'en':'hi'}><div className="website-nav">
  <Brand/><nav className="website-desktop-links" aria-label="Website navigation">{navLinks}</nav>
  <div className="website-nav-actions"><div className="website-language" role="group" aria-label="Website language"><button disabled={!ready} onClick={()=>setLanguage('english')} aria-pressed={english} type="button" lang="en" aria-label="English">EN</button><button disabled={!ready} onClick={()=>setLanguage('hinglish')} aria-pressed={!english} type="button" lang="hi" aria-label="हिन्दी">हिं</button></div><Link className="website-login" href="/app">{user?(english?'My account':'मेरा अकाउंट'):(english?'Log in':'लॉग इन')}<ArrowUpRight size={15}/></Link></div>
 </div><nav className="website-mobile-tabs" aria-label="Website navigation tabs">{navLinks}{settings.navigation.showHowToUse&&<Link href="/help" aria-current={pathname==='/help'?'page':undefined}>{english?'How it works':'कैसे काम करता है'}</Link>}<Link href="/app" aria-current={pathname?.startsWith('/app')?'page':undefined}>{user?(english?'My account':'मेरा अकाउंट'):(english?'Log in':'लॉग इन')}</Link></nav></header>;
}
