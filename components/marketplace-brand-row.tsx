const MARKETPLACE_BRANDS = [
  { label: "Amazon", src: "/brands/marketplaces/amazon.svg", className: "marketplace-logo-amazon" },
  { label: "Flipkart", src: "/brands/marketplaces/flipkart.svg", className: "marketplace-logo-flipkart" },
  { label: "Meesho", src: "/brands/marketplaces/meesho.svg", className: "marketplace-logo-meesho" },
  { label: "Shopify", src: "/brands/marketplaces/shopify.svg", className: "marketplace-logo-shopify" },
  { label: "WooCommerce", src: "/brands/marketplaces/woocommerce.svg", className: "marketplace-logo-woocommerce" },
] as const;

export function MarketplaceBrandRow() {
  return (
    <div className="marketplace-brand-row" aria-label="Amazon, Flipkart, Meesho, Shopify and WooCommerce">
      {MARKETPLACE_BRANDS.map((brand) => (
        <span className="marketplace-brand-item" role="img" aria-label={brand.label} key={brand.label}>
          <img
            className={`marketplace-logo ${brand.className}`}
            src={brand.src}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        </span>
      ))}
    </div>
  );
}
