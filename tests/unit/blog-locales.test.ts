import {it,expect} from 'vitest';
import {availableBlogLocales,localizedBlogPost,blogLanguageAlternates} from '@/core/blog-locales';
import type {BlogPostRecord} from '@/core/blog-cms';
const post={slug:'fixture',htmlContent:'<p>हिंदी लेख</p>',htmlContentEn:'<p>English body</p>',canonicalUrl:'',localeMetadata:{hi:{title:'हिंदी शीर्षक',subtitle:'सारांश',seoTitle:'',seoDescription:''},en:{title:'English title',subtitle:'Summary',seoTitle:'',seoDescription:''}}} as BlogPostRecord;
it('has reciprocal locale URLs and default without empty languages',()=>{expect(availableBlogLocales(post)).toEqual(['hi','en']);expect(blogLanguageAlternates(post)).toEqual({'hi-IN':'/hi/blog/fixture','en-IN':'/en/blog/fixture','x-default':'/hi/blog/fixture'});expect(localizedBlogPost(post,'hi')?.title).toBe('हिंदी शीर्षक');expect(availableBlogLocales({...post,htmlContentEn:''})).toEqual(['hi']);});
it('preserves legacy/custom canonical editorial decisions',()=>{expect(availableBlogLocales({...post,localeMetadata:{}})).toEqual([]);expect(availableBlogLocales({...post,canonicalUrl:'/guide'})).toEqual([]);});
