import { DEFAULT_SEO_SETTINGS, parseSeoSettings, type SeoSettings } from '@/core/seo-settings';
import {getD1} from './runtime';
export async function seoSettingsSnapshot(){const row=await getD1().prepare("SELECT config_json AS raw FROM site_settings WHERE id='seo'").first<{raw:string}>();return {revision:row?.raw??null,settings:row?parseSeoSettings(JSON.parse(row.raw)):DEFAULT_SEO_SETTINGS};}
export async function getPublicSeoSettings():Promise<SeoSettings>{try{return (await seoSettingsSnapshot()).settings;}catch{return DEFAULT_SEO_SETTINGS;}}
export class SeoSettingsConflict extends Error{}
export async function savePublicSeoSettings(settings:SeoSettings,userId:string,expectedRevision:string|null):Promise<string>{
 const db=getD1(),now=new Date().toISOString(),before=expectedRevision?parseSeoSettings(JSON.parse(expectedRevision)):DEFAULT_SEO_SETTINGS;
 const predicate="((?5 IS NULL AND NOT EXISTS(SELECT 1 FROM site_settings WHERE id='seo')) OR EXISTS(SELECT 1 FROM site_settings WHERE id='seo' AND config_json=?5))";
 const results=await db.batch([
  db.prepare("INSERT INTO audit_events(id,user_id,action,resource_type,resource_id,metadata_json,created_at) SELECT ?1,?2,'seo.settings.changed','site_settings','seo',?3,?4 WHERE "+predicate).bind(crypto.randomUUID(),userId,JSON.stringify({before,after:settings}),now,expectedRevision),
  db.prepare("INSERT INTO site_settings(id,config_json,updated_by,updated_at) SELECT 'seo',?1,?2,?3 WHERE ((?4 IS NULL AND NOT EXISTS(SELECT 1 FROM site_settings WHERE id='seo')) OR EXISTS(SELECT 1 FROM site_settings WHERE id='seo' AND config_json=?4)) ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at WHERE site_settings.config_json=?4").bind(JSON.stringify(settings),userId,now,expectedRevision),
 ]);
 if(results[1].meta.changes!==1)throw new SeoSettingsConflict('SEO settings changed during review. Reload and review again.');
 return now;
}
export function seoSettingsImpact(before:SeoSettings,after:SeoSettings):string[]{
 const changes:string[]=[];for(const group of ['crawlers','discovery','indexNow','future'] as const){for(const key of Object.keys(after[group])){const a=after[group] as Record<string,unknown>,b=before[group] as Record<string,unknown>;if(JSON.stringify(a[key])!==JSON.stringify(b[key]))changes.push(group+'.'+key+': '+JSON.stringify(b[key])+' → '+JSON.stringify(a[key]));}}
 return changes.length?changes:['Publisher identity/verification update; crawler policy unchanged.'];
}
