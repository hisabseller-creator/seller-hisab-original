import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for(const width of [320,360,390,412,768,1280])test('Hindi article reflow '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/blog/local-hindi-fixture');
 await expect(page.locator('h1')).toContainText('ऑनलाइन');await expect(page.locator('html')).toHaveAttribute('lang','hi');
 expect(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+1&&!e.closest('.blog-table-scroll');}).slice(0,8).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right}))}))).toMatchObject({scroll:width});
 const table=page.locator('.blog-table-scroll:visible');await expect(table).toHaveAttribute('tabindex','0');await table.focus();await page.keyboard.press('ArrowRight');
 const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations;expect(violations).toEqual([]);
 if(process.env.VISUAL_REGRESSION!=='0')await expect(page).toHaveScreenshot('hindi-article-'+width+'.png',{fullPage:true,animations:'disabled'});
});
test('same-page bilingual URLs remain canonical until deliberate growth activation',async({page})=>{
 await page.goto('/blog/local-hindi-fixture');await expect(page).toHaveURL(/\/blog\/local-hindi-fixture$/);await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',/\/blog\/local-hindi-fixture$/);
 await expect(page.locator('link[hreflang]')).toHaveCount(0);await page.getByRole('group',{name:'Article language',exact:true}).getByRole('button',{name:'English',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('article[lang="en"]')).toBeVisible();
 await page.getByRole('group',{name:'Article language',exact:true}).getByRole('button',{name:'हिंदी',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','hi');expect((await page.goto('/en/blog/local-hindi-fixture'))?.status()).toBe(404);
});
