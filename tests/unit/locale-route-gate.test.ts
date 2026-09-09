import {it,expect,vi} from 'vitest';
import {DEFAULT_SEO_SETTINGS} from '@/core/seo-settings';
const state=vi.hoisted(()=>({enabled:false}));
vi.mock('@/server/seo-settings',()=>({getPublicSeoSettings:async()=>({...DEFAULT_SEO_SETTINGS,future:{...DEFAULT_SEO_SETTINGS.future,localeUrlsEnabled:state.enabled}})}));
vi.mock('next/navigation',()=>({notFound:()=>{throw Error('not_found');},permanentRedirect:()=>{throw Error('redirect');}}));
vi.mock('@/server/blog',()=>({getPublishedBlogPost:async()=>({slug:'fixture',title:'Legacy',htmlContent:'<p>हिंदी</p>',htmlContentEn:'<p>English</p>',canonicalUrl:'',localeMetadata:{hi:{title:'हिंदी',subtitle:'सार',seoTitle:'',seoDescription:''},en:{title:'English',subtitle:'Summary',seoTitle:'',seoDescription:''}}})}));
vi.mock('@/components/blog-article',()=>({BlogArticle:()=>null}));
import {generateMetadata} from '@/server/localized-blog-page';
it('prepared locale routes fail closed by default and emit reciprocal metadata only after activation',async()=>{state.enabled=false;await expect(generateMetadata({params:Promise.resolve({locale:'hi',slug:'fixture'})})).rejects.toThrow('not_found');state.enabled=true;const meta=await generateMetadata({params:Promise.resolve({locale:'en',slug:'fixture'})});expect(meta.alternates).toEqual({canonical:'/en/blog/fixture',languages:{'hi-IN':'/hi/blog/fixture','en-IN':'/en/blog/fixture','x-default':'/hi/blog/fixture'}});});
