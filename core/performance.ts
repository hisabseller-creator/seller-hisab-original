export const PERFORMANCE_ROUTES=['home','blog','article','analysis','account','admin','pricing','public'] as const;
export function performanceRoute(path:string):typeof PERFORMANCE_ROUTES[number]{
 if(path==='/')return 'home';if(path==='/blog')return 'blog';if(/^\/(?:hi\/|en\/)?blog\//.test(path))return 'article';if(path.startsWith('/analyze'))return 'analysis';if(path.startsWith('/app'))return 'account';if(path.startsWith('/admin'))return 'admin';if(path==='/pricing')return 'pricing';return 'public';
}
