import {test,expect} from '@playwright/test';import AxeBuilder from '@axe-core/playwright';
for(const width of [320,640,1280])for(const route of ['/app','/analyze'])test(route+' keyboard/reflow/axe '+width,async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width,height:900});await page.goto(route);await expect(page.locator('h1').first()).toBeVisible();
 if(route==='/analyze'){
  await expect(page.getByRole('radiogroup',{name:'Marketplace'})).toBeVisible();
  await expect(page.getByRole('radio',{name:/Meesho/})).toBeVisible();
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
 await page.keyboard.press('Tab');await expect(page.locator(':focus')).toBeVisible();
 if(process.env.VISUAL_REGRESSION!=='0')await expect(page).toHaveScreenshot(route.slice(1)+'-empty-'+width+'.png',{fullPage:true,animations:'disabled'});
});
// 640/320 CSS widths model 200%/400% reflow of a 1280px viewport; this is
// not a claim that physical mobile devices or every OS zoom setting were tested.
