# SellerHisab Search + AI Search SEO Implementation

Status: code-ready candidate, not deployed by this package.

## Implemented in source

- Crawl/index foundation
  - explicit Googlebot and OAI-SearchBot public crawling
  - private `/app`, `/admin`, `/api` search exclusion
  - private HTTP responses also emit `X-Robots-Tag: noindex, nofollow, noarchive`
  - canonical apex remains `https://sellerhisab.com`
  - sitemap contains only public canonical pages and uses real blog `updatedAt` dates instead of setting every URL to the current time
  - global `max-image-preview:large`
  - custom noindex 404 page
- Entity/trust layer
  - Organization + WebSite + SoftwareApplication structured data
  - About page
  - SellerHisab Research Team author profile
  - Editorial Policy
  - Corrections Policy
  - methodology/trust pages linked from public navigation/footer
- Search architecture
  - marketplace hubs for Meesho, Amazon India and Flipkart
  - seller-finance guide hub and six evidence-first guides
  - stronger internal links between calculators, guides, marketplace hubs, methodology and analysis
- AEO/GEO
  - every public calculator page now contains a direct answer, formula, worked example, FAQ content and related-resource links
  - FAQPage + WebApplication + BreadcrumbList structured data for calculator pages
  - Article/Breadcrumb structured data for guide pages
  - absolute canonical schema URLs rather than relative breadcrumb/mainEntity URLs
- Blog/Discover
  - BlogPosting author URL and publisher logo
  - visible author, published date and updated date
  - self-canonical pagination for `/blog?page=N`
  - hero images render with `object-cover`
  - new admin hero uploads are server-validated as at least 1200 px wide and landscape close to 16:9
- IndexNow
  - public IndexNow key file
  - admin publish/update/delete pings IndexNow without making publishing fail if IndexNow is unavailable
  - `pnpm seo:indexnow` manual submission helper
- Brand/search copy
  - homepage title/description aligned to marketplace seller profit and margin intent
  - consistent SellerHisab brand definition used in structured data

## Deliberately not automated

These require owner accounts, external platforms, credentials, editorial operations or earned third-party coverage and cannot be truthfully completed by a source-code patch:

1. Google Search Console Domain Property DNS verification, sitemap submission, URL inspection and indexing requests.
2. Bing Webmaster Tools account/domain verification.
3. Cloudflare dashboard confirmation that verified Google/OpenAI search crawlers are not challenged by WAF/Bot settings.
4. GA4 Measurement ID and conversion configuration.
5. Official LinkedIn/X/YouTube/Instagram profiles and `sameAs` links beyond profiles already configured in SellerHisab.
6. Backlinks, digital PR, seller-community mentions, YouTube creator coverage and startup-directory profiles.
7. Google Discover/News appearance or AI Overview/ChatGPT/Gemini citations. Eligibility can be improved; placement cannot be guaranteed.
8. Original cross-seller benchmark publication remains disabled until the existing privacy/cohort gates are satisfied.

## Truth rules preserved

- No marketplace fee or policy value was invented for SEO content.
- No fake review/rating structured data.
- No fake “last updated” refresh loop.
- No thin mass-generated pages.
- No private account/report pages added to sitemap.
- No marketplace password, session-cookie or scraping workflow.
- No billing, connector, finance, role/approval or database migration change.
