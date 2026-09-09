import {calculateBlogReadTime,type BlogPostRecord} from './blog-cms';
export type BlogLocale='hi'|'en';
export function availableBlogLocales(post:BlogPostRecord):BlogLocale[]{
 if(post.canonicalUrl)return []; // explicit editorial canonical remains authoritative
 return (['hi','en'] as const).filter(locale=>{
  const fields=post.localeMetadata?.[locale],html=locale==='hi'?post.htmlContent:post.htmlContentEn;
  return Boolean(fields?.title.trim()&&fields.subtitle.trim()&&html.trim());
 });
}
export function localeBlogPath(post:BlogPostRecord,locale:BlogLocale){return '/'+locale+'/blog/'+post.slug;}
export function localizedBlogPost(post:BlogPostRecord,locale:BlogLocale):BlogPostRecord|null{
 if(!availableBlogLocales(post).includes(locale))return null;
 const fields=post.localeMetadata![locale]!;
 return {...post,...fields,readTime:calculateBlogReadTime(locale==='hi'?post.htmlContent:post.htmlContentEn),canonicalUrl:localeBlogPath(post,locale)};
}
export function blogLanguageAlternates(post:BlogPostRecord):Record<string,string>{const locales=availableBlogLocales(post);return Object.fromEntries([...locales.map(l=>[l+'-IN',localeBlogPath(post,l)]),...(locales.length?[['x-default',localeBlogPath(post,locales[0])]]:[])]);}
export function localeDiagnostics(post:BlogPostRecord){return (['hi','en'] as const).map(locale=>({locale,indexable:post.indexable&&availableBlogLocales(post).includes(locale),hasBody:Boolean((locale==='hi'?post.htmlContent:post.htmlContentEn).trim()),hasTitle:Boolean(post.localeMetadata?.[locale]?.title.trim()),hasDescription:Boolean(post.localeMetadata?.[locale]?.subtitle.trim())}));}
