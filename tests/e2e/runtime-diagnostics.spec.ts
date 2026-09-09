import {test,expect} from '@playwright/test';
test('critical routes have no browser runtime errors',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 for(const path of ['/blog','/blog/local-hindi-fixture','/app','/analyze']){await page.goto(path);await expect(page.locator('h1').first(),JSON.stringify({path,errors})).toBeVisible();}
 expect(errors).toEqual([]);
});
