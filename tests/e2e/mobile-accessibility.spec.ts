import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for(const width of [320,360,390,412,768,1280]){
 test('public reflow and accessibility '+width,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/blog');
  await expect(page.locator('h1')).toBeVisible();
  const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+1;}).slice(0,12).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right}))}));
  expect(layout.scroll,JSON.stringify(layout)).toBe(width);
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(results.violations).toEqual([]);
  if(process.env.VISUAL_REGRESSION!=='0')await expect(page).toHaveScreenshot('blog-'+width+'.png',{fullPage:true,animations:'disabled'});
 });
}
test('keyboard focus remains visible on authentication route',async({page})=>{await page.goto('/app');await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible({timeout:30_000});await page.getByRole('textbox',{name:'Mobile number / Email'}).focus();await page.keyboard.press('Tab');await expect(page.locator(':focus')).toBeVisible();await page.setViewportSize({width:320,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);});
test('critical API mutations remain private',async({request})=>{for(const url of ['/api/account/connections/jobs?id=not-owned','/api/admin/seo-settings'])expect((await request.get(url)).status()).toBe(401);expect((await request.post('/api/payments/webhook',{data:{event:'payment.captured'}})).status()).toBe(400);});
