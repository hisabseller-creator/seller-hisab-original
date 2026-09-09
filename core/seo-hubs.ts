export type SeoContentSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type SeoContentConfig = {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  headline: string;
  directAnswer: string;
  sections: SeoContentSection[];
  related: Array<{ href: string; label: string }>;
};

export const marketplaceHubs: Record<string, SeoContentConfig> = {
  meesho: {
    slug: "meesho",
    title: "Meesho Seller Profit & Margin Hub",
    description: "Free Meesho seller calculators and practical guides for contribution margin, RTO loss, returns, break-even price and settlement checks.",
    eyebrow: "Marketplace hub",
    headline: "Meesho seller profitability: calculate the money, then inspect the evidence.",
    directAnswer: "For SellerHisab, Meesho profitability is not treated as sales minus product cost. The safer workflow starts from supplied settlement evidence, subtracts known variable costs, keeps Return/RTO effects visible and leaves missing evidence incomplete instead of guessing it.",
    sections: [
      {
        title: "Start with financial evidence",
        paragraphs: ["Use the available Payments or Payments to Date report as the financial starting point. Add SKU cost before treating contribution as complete, and add Orders/Ads evidence when you want deeper matching or action quality."],
        bullets: ["Stable Sub-Order Number and SKU matter for reconciliation.", "Unknown critical monetary layouts fail closed.", "Cross-period returns, RTOs and adjustments can remain provisional until evidence resolves."],
      },
      {
        title: "Useful free tools",
        bullets: ["Profit calculator for contribution after known costs.", "RTO and return-loss calculators to translate rates into money.", "Break-even price, ROAS and ACoS calculators using seller-entered evidence.", "Settlement mismatch checks for expected versus received money."],
      },
      {
        title: "What SellerHisab does not assume",
        bullets: ["No hard-coded hidden marketplace fee table inside a generic profit number.", "No invented damage/recovery cost when a report does not prove it.", "No claim that a matching total proves every sub-order is reconciled."],
      },
    ],
    related: [
      { href: "/meesho-profit-calculator", label: "Meesho Profit Calculator" },
      { href: "/meesho-rto-calculator", label: "Meesho RTO Loss Calculator" },
      { href: "/meesho-settlement-checker", label: "Meesho Settlement Checker" },
      { href: "/guides/contribution-margin", label: "Contribution Margin Guide" },
    ],
  },
  amazon: {
    slug: "amazon",
    title: "Amazon India Seller Profit & Settlement Hub",
    description: "SellerHisab guidance for Amazon India order, settlement, contribution, return and break-even analysis using supported seller evidence.",
    eyebrow: "Marketplace hub",
    headline: "Amazon India seller economics need order evidence and settlement evidence together.",
    directAnswer: "SellerHisab treats an Amazon seller's order value and marketplace settlement as different financial evidence. A supported Orders export establishes the order lines, while a matching settlement report supplies the attributable money used for contribution and reconciliation.",
    sections: [
      {
        title: "Supported file-first evidence",
        bullets: ["Orders export with order id, SKU, quantity and item price.", "Settlement Flat File V2 for settlement-level financial evidence.", "Product cost and optional advertising evidence for deeper contribution analysis."],
      },
      {
        title: "Why the separation matters",
        paragraphs: ["Order value answers what was sold. Settlement evidence answers what money was attributable after marketplace financial events. SellerHisab keeps those layers separate so missing settlement evidence is not silently converted into confirmed profit."],
      },
      {
        title: "Official connection remains optional",
        paragraphs: ["Where an approved official connector is configured, SellerHisab can use read-only order/finance sync. File analysis remains available separately and never requires a Seller Central password or session cookie."],
      },
    ],
    related: [
      { href: "/analyze", label: "Analyze Seller Reports" },
      { href: "/guides/settlement-reconciliation", label: "Settlement Reconciliation Guide" },
      { href: "/guides/contribution-margin", label: "Contribution Margin Guide" },
      { href: "/methodology", label: "Calculation Methodology" },
    ],
  },
  flipkart: {
    slug: "flipkart",
    title: "Flipkart Seller Profit & Settlement Hub",
    description: "SellerHisab guidance for Flipkart seller order, settlement, contribution and reconciliation analysis using supported reports.",
    eyebrow: "Marketplace hub",
    headline: "Flipkart seller profitability starts with stable order-line and settlement evidence.",
    directAnswer: "SellerHisab links Flipkart money to seller activity only when the report provides a stable supported identifier such as an Order Item ID plus SKU, or explicit order-level settlement evidence. If the mapping is ambiguous, the result stays incomplete instead of being guessed.",
    sections: [
      {
        title: "Supported evidence pattern",
        bullets: ["Orders report with Order Item ID, seller SKU, status, quantity and selling price.", "Settlement/P&L evidence with a stable supported identifier and settlement amount.", "Seller-entered SKU cost before contribution is treated as complete."],
      },
      {
        title: "Reconciliation discipline",
        paragraphs: ["A broad Order ID can contain multiple economic lines, so SellerHisab prefers the most specific stable identifier the report safely exposes. Corrections and later adjustments remain revision-aware instead of overwriting financial history without a trace."],
      },
      {
        title: "No unofficial access",
        paragraphs: ["Official connector routes require approved authorization. SellerHisab does not ask for marketplace passwords, OTPs, session cookies or scraping shortcuts."],
      },
    ],
    related: [
      { href: "/analyze", label: "Analyze Seller Reports" },
      { href: "/guides/settlement-reconciliation", label: "Settlement Reconciliation Guide" },
      { href: "/guides/sku-profitability", label: "SKU Profitability Guide" },
      { href: "/methodology", label: "Calculation Methodology" },
    ],
  },
};

export const guidePages: Record<string, SeoContentConfig> = {
  "contribution-margin": {
    slug: "contribution-margin",
    title: "Marketplace Seller Contribution Margin Guide",
    description: "Understand contribution margin for marketplace sellers, what belongs in it, what does not, and why missing settlement or cost evidence changes confidence.",
    eyebrow: "Seller finance guide",
    headline: "Contribution margin tells you what remains after the known variable economics of an order.",
    directAnswer: "SellerHisab calculates contribution from supplied settlement or attributable marketplace cash flow minus known product cost, packaging, seller-entered variable costs and attributable advertising. It does not label that number Net Profit when taxes, fixed overhead or other critical evidence are missing.",
    sections: [
      { title: "Core formula", paragraphs: ["Contribution = supplied settlement − product cost − packaging − other known variable costs − attributable ads."] },
      { title: "Why sales alone are not enough", paragraphs: ["Sales value can be useful operationally, but it does not prove the seller received the same amount. Settlement evidence and cost completeness determine whether contribution can be called confirmed."] },
      { title: "Confidence states", bullets: ["Confirmed: required cost, settlement and sufficiently resolved order state are present.", "Provisional: known evidence can still change because of a pending settlement, return, RTO, exchange or adjustment.", "Incomplete: a critical amount, identifier, status or cost is missing."] },
    ],
    related: [
      { href: "/methodology", label: "Full Methodology" },
      { href: "/meesho-profit-calculator", label: "Meesho Profit Calculator" },
      { href: "/guides/sku-profitability", label: "SKU Profitability Guide" },
    ],
  },
  "settlement-reconciliation": {
    slug: "settlement-reconciliation",
    title: "Marketplace Settlement Reconciliation Guide",
    description: "Learn how marketplace orders, settlement reports and bank credits should be matched without treating a broad total as proof that every order is correct.",
    eyebrow: "Seller finance guide",
    headline: "Settlement reconciliation connects order evidence to marketplace money and then to bank reality.",
    directAnswer: "A reliable reconciliation follows the chain Order → marketplace settlement/payout → bank actual. Matching only the grand totals is not enough when returns, adjustments, batching or cross-period credits can move money between periods.",
    sections: [
      { title: "Evidence hierarchy", bullets: ["Order: what the seller sold and at what line-level identity.", "Marketplace settlement/payout: what the marketplace financially attributed or paid.", "Bank actual: what money was actually credited or debited."] },
      { title: "Matching discipline", paragraphs: ["Use exact stable references first. Where bank narration lacks an exact reference, only a unique exact amount and currency candidate inside the supported date window can be auto-matched; ambiguous candidates stay unmatched."] },
      { title: "Cross-period reality", paragraphs: ["A return, refund, adjustment or payout can land after the original order period. SellerHisab therefore keeps unresolved states provisional rather than forcing same-month closure."] },
    ],
    related: [
      { href: "/meesho-settlement-checker", label: "Settlement Checker" },
      { href: "/app/cash", label: "Bank & Cash Truth" },
      { href: "/methodology", label: "Methodology" },
    ],
  },
  "rto-impact": {
    slug: "rto-impact",
    title: "RTO Impact on Marketplace Seller Margin",
    description: "Understand how RTO rate becomes a rupee loss and why safe RTO thresholds depend on observed successful-order contribution and failure loss.",
    eyebrow: "Seller finance guide",
    headline: "RTO is not just a percentage; it changes how much contribution survives.",
    directAnswer: "A simple exposure estimate is shipped orders × observed RTO rate × observed loss per RTO. A safer operating threshold depends on both successful-order contribution and failure loss, not on one universal percentage.",
    sections: [
      { title: "Exposure formula", paragraphs: ["Estimated RTO exposure = shipped orders × RTO rate × observed average economic loss per failed shipment."] },
      { title: "Safe threshold", paragraphs: ["SellerHisab's deterministic threshold uses observed successful-order contribution and observed failure loss. If the sample is insufficient, the answer stays Insufficient Data."] },
      { title: "Do not invent hidden loss", paragraphs: ["Packaging, negative settlement and explicit charges can be included when proven. Inventory damage or recovery value is not invented when the source report does not establish it."] },
    ],
    related: [
      { href: "/meesho-rto-calculator", label: "RTO Loss Calculator" },
      { href: "/meesho-return-loss-calculator", label: "Return Loss Calculator" },
      { href: "/guides/break-even-price", label: "Break-even Price Guide" },
    ],
  },
  "break-even-price": {
    slug: "break-even-price",
    title: "Marketplace Seller Break-even Price Guide",
    description: "Calculate a defensible break-even selling price from known costs, failure exposure and the seller's observed retained settlement rate.",
    eyebrow: "Seller finance guide",
    headline: "Break-even price should come from your own economics, not a hidden fee assumption.",
    directAnswer: "SellerHisab estimates break-even selling price as required unit economics divided by the observed retained settlement rate. Required unit economics can include product, packaging, variable cost, attributable ads and expected failure loss when those inputs are available.",
    sections: [
      { title: "Core formula", paragraphs: ["Approximate break-even price = required unit economics ÷ observed retained settlement rate."] },
      { title: "Required economics", bullets: ["Product cost.", "Packaging cost.", "Other supplied variable cost.", "Attributable advertising.", "Expected Return/RTO loss when supported by evidence."] },
      { title: "Confidence matters", paragraphs: ["If the retained rate is based on a small or incomplete sample, the price output should remain low-confidence rather than presented as a guaranteed safe price."] },
    ],
    related: [
      { href: "/meesho-break-even-price", label: "Break-even Price Calculator" },
      { href: "/guides/contribution-margin", label: "Contribution Margin Guide" },
      { href: "/meesho-acos-calculator", label: "Max ACoS Calculator" },
    ],
  },
  "sku-profitability": {
    slug: "sku-profitability",
    title: "SKU Profitability Guide for Marketplace Sellers",
    description: "Understand product-level contribution, return/RTO context and why high sales do not automatically mean a profitable SKU.",
    eyebrow: "Seller finance guide",
    headline: "A high-sales SKU can still destroy contribution.",
    directAnswer: "SKU profitability should be evaluated from attributable settlement and known SKU-level costs, then read alongside return/RTO evidence and sample size. Revenue alone cannot establish that a SKU is economically healthy.",
    sections: [
      { title: "What to inspect", bullets: ["Contribution per order and contribution margin.", "Return and RTO rate with sample size.", "Missing cost or settlement evidence.", "Break-even price and advertising limit where supported."] },
      { title: "Decision states", paragraphs: ["SellerHisab can route a SKU toward actions such as review, reprice, reduce ads or scale only when deterministic evidence supports the recommendation. Missing data remains visible instead of being silently filled."] },
      { title: "Why sample size matters", paragraphs: ["A loss or return percentage based on a handful of orders can be unstable. The evidence count should be visible with any operational decision."] },
    ],
    related: [
      { href: "/meesho-sku-profit-calculator", label: "SKU Profit Calculator" },
      { href: "/guides/contribution-margin", label: "Contribution Margin Guide" },
      { href: "/analyze", label: "Analyze a Report" },
    ],
  },
  "marketplace-profit-and-loss": {
    slug: "marketplace-profit-and-loss",
    title: "Marketplace P&L: Sales, Settlement, Contribution and Cash",
    description: "A practical guide to separating marketplace sales, settlement, contribution and bank cash so financial decisions are not based on one misleading number.",
    eyebrow: "Seller finance guide",
    headline: "Marketplace P&L needs more than a sales total.",
    directAnswer: "For marketplace operations, SellerHisab separates customer-facing sales, marketplace settlement, variable-cost contribution and bank actual. Those layers answer different questions and should not be collapsed into one number when evidence is incomplete.",
    sections: [
      { title: "Four distinct questions", bullets: ["Sales: what did customers order?", "Settlement: what money did the marketplace attribute/pay?", "Contribution: what remains after known variable economics?", "Bank actual: what cash actually reached the bank?"] },
      { title: "Why this matters", paragraphs: ["Returns, RTOs, adjustments, ads, missing SKU cost and payout timing can make these layers diverge. A useful seller-finance system shows the divergence instead of hiding it."] },
      { title: "What is not automatically Net Profit", paragraphs: ["Contribution is not automatically Net Profit. Taxes, fixed overhead and other non-variable business costs require explicit evidence before a net-profit claim is supportable."] },
    ],
    related: [
      { href: "/guides/settlement-reconciliation", label: "Settlement Reconciliation Guide" },
      { href: "/guides/contribution-margin", label: "Contribution Margin Guide" },
      { href: "/app/cash", label: "Bank & Cash Truth" },
    ],
  },
};
