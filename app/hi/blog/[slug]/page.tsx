import Page,{generateMetadata as metadata} from '@/server/localized-blog-page';
export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>};
export function generateMetadata({params}:Props){return metadata({params:params.then(p=>({...p,locale:'hi'}))});}
export default function LocalePage({params}:Props){return Page({params:params.then(p=>({...p,locale:'hi'}))});}
