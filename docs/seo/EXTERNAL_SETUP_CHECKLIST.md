# External SEO Setup Checklist

Do these only after the SEO code candidate is deployed and live checks pass.

## Google Search Console

- Create a Domain Property for `sellerhisab.com`.
- Add the Google-provided TXT verification record in Cloudflare DNS.
- Submit `https://sellerhisab.com/sitemap.xml`.
- Inspect and request indexing for:
  - `/`
  - `/pricing`
  - `/calculators`
  - `/methodology`
  - `/help`
  - `/contact`
  - `/blog`
  - `/marketplaces/meesho`
  - `/guides/contribution-margin`
  - `/guides/settlement-reconciliation`
  - high-value calculator URLs
- Confirm `/app`, `/admin` and private/report URLs are not indexed.

## Bing Webmaster Tools

- Verify the same domain.
- Submit the sitemap.
- Confirm IndexNow key file is reachable at the key location shipped in source.
- Submit the initial public URL set once after deploy.

## Cloudflare crawler access

Check WAF/Bot controls so these public crawlers receive normal public content rather than a challenge:
- Googlebot
- OAI-SearchBot

Never weaken authentication or private-route protection to achieve this.

## Analytics

When a GA4 Measurement ID is available, add analytics with consent/privacy behavior appropriate to the product. Track the business funnel rather than pageviews alone:
- organic landing
- calculator use
- analysis started
- analysis completed
- signup
- checkout started
- paid conversion

## Entity profiles

Create/standardize official brand profiles only when the URLs are final. Keep the meaning of the brand description consistent:
- LinkedIn
- X
- YouTube
- Instagram
- relevant startup/product directories

Then add only verified official URLs to Organization `sameAs`.

## Editorial/authority operations

- Publish marketplace-specific content only with primary-source evidence for time-sensitive fees/policies.
- Use 1200px+ landscape hero images.
- Keep real published/updated dates.
- Create original calculations/research rather than rewriting generic seller articles.
- Earn citations through useful tools, research, CA/accounting sources, seller educators and legitimate publications.
- Avoid paid link farms, PBNs, spam comments and bulk directory blasts.
