import type { SeoPageConfig } from "./seo-pages";

export type UniversalCalculatorKind = "profit" | "failure" | "break-even" | "acos" | "roas";

export type UniversalCalculatorEntry = {
  kind: UniversalCalculatorKind;
  href: string;
  title: string;
  shortTitle: string;
  description: string;
  formula: string;
  tone: "blue" | "red" | "green" | "amber" | "violet";
};

export const universalCalculatorCatalog: UniversalCalculatorEntry[] = [
  {
    kind: "profit",
    href: "/profit-calculator",
    title: "Profit Calculator",
    shortTitle: "Profit",
    description: "Estimate contribution from actual payout or settlement evidence and your known costs.",
    formula: "Net payout / settlement − known variable costs",
    tone: "blue",
  },
  {
    kind: "failure",
    href: "/return-rto-loss-calculator",
    title: "Return / RTO Loss Calculator",
    shortTitle: "Returns / RTO",
    description: "Turn your observed return or RTO rate into a rupee loss estimate.",
    formula: "Orders × failure rate × loss per failure",
    tone: "red",
  },
  {
    kind: "break-even",
    href: "/break-even-price-calculator",
    title: "Break-even Price Calculator",
    shortTitle: "Break-even",
    description: "Find the minimum selling price supported by your costs and retained payout rate.",
    formula: "Required unit economics ÷ retained payout rate",
    tone: "green",
  },
  {
    kind: "acos",
    href: "/max-acos-calculator",
    title: "Max ACoS Calculator",
    shortTitle: "Max ACoS",
    description: "See the maximum ad-cost percentage your pre-ad contribution can sustain.",
    formula: "Pre-ad contribution ÷ attributable ad sales × 100",
    tone: "amber",
  },
  {
    kind: "roas",
    href: "/break-even-roas-calculator",
    title: "Break-even ROAS Calculator",
    shortTitle: "Break-even ROAS",
    description: "Find the minimum ROAS supported by your contribution before advertising.",
    formula: "Attributable ad sales ÷ pre-ad contribution",
    tone: "violet",
  },
];

const hrefByKind = Object.fromEntries(universalCalculatorCatalog.map((tool) => [tool.kind, tool.href])) as Record<UniversalCalculatorKind, string>;

export function universalCalculatorHrefForKind(kind: UniversalCalculatorKind) {
  return hrefByKind[kind];
}

const related = (currentHref: string) => universalCalculatorCatalog
  .filter((tool) => tool.href !== currentHref)
  .slice(0, 3)
  .map((tool) => ({ href: tool.href, label: tool.title }));

export const universalCalculatorSeoPages: Record<string, SeoPageConfig> = {
  "profit-calculator": {
    slug: "profit-calculator",
    title: "Seller Profit Calculator",
    description: "Estimate seller contribution from actual marketplace or gateway payout evidence and known product, packaging and advertising costs.",
    eyebrow: "Universal seller calculator",
    headline: "How much contribution did this order actually leave?",
    intro: "Works across marketplaces. Start with the actual net payout or settlement you received, then subtract the costs you actually know.",
    directAnswer: "Use the attributable net payout or settlement as the money input, then subtract product cost, packaging, other known variable costs and attributable ads. If payout evidence, tax or fixed overhead is missing, treat the result as contribution rather than confirmed Net Profit.",
    formula: "Contribution = net payout / settlement − product cost − packaging − other known variable costs − attributable ads",
    example: "If the attributable payout is ₹540 and known variable costs total ₹410, contribution is ₹130. Fixed overhead and tax remain outside this quick estimate unless supplied.",
    toolType: "margin",
    guideTitle: "Use real money evidence",
    guide: [
      "Use the actual marketplace settlement or payment-gateway payout attributable to the order.",
      "Subtract only costs you actually know instead of inserting a hidden marketplace fee table.",
      "Keep missing payout, tax or fixed-overhead evidence visible rather than silently treating it as zero.",
    ],
    faqs: [
      ["Does this work for every marketplace?", "Yes. The formula is marketplace-neutral because you enter the actual payout or settlement and your own known costs."],
      ["Can I use gross sales as settlement?", "No. Gross order value and net marketplace or gateway payout answer different questions."],
      ["Is the result Net Profit?", "Not automatically. It is a contribution estimate from the values supplied."],
    ],
    related: [...related("/profit-calculator"), { href: "/calculators", label: "All 5 Calculators" }],
  },
  "return-rto-loss-calculator": {
    slug: "return-rto-loss-calculator",
    title: "Return & RTO Loss Calculator",
    description: "Estimate seller return or RTO economic loss from order volume, observed failure rate and actual average loss per failed order.",
    eyebrow: "Universal seller calculator",
    headline: "What are returns or RTOs actually costing you?",
    intro: "Use the same evidence-based formula for any marketplace: your order count, observed failure rate and observed loss per failed order.",
    directAnswer: "Multiply the relevant order count by the observed return or RTO rate and the observed average economic loss per failed order. Do not invent damage, recovery or marketplace charges that your evidence does not prove.",
    formula: "Estimated failure loss = orders × observed return/RTO rate × observed average loss per failed order",
    example: "For 200 orders, a 9% observed failure rate and ₹80 average economic loss per failure, estimated exposure is ₹1,440.",
    toolType: "failure",
    guideTitle: "Measure the loss, not just the rate",
    guide: [
      "Use one consistent evidence period for order count and failure rate.",
      "Use observed average economic loss rather than a universal assumed charge.",
      "Cross-period refunds, adjustments or recoveries can still change the final result.",
    ],
    faqs: [
      ["Can I use this for both returns and RTO?", "Yes. Use the relevant observed failure rate and average economic loss for the event you are measuring."],
      ["Is there one safe failure percentage for every seller?", "No. Sustainability depends on successful-order contribution and the loss created by a failed order."],
      ["Does this need marketplace API access?", "No. The quick calculator uses the numbers you enter in the browser."],
    ],
    related: [...related("/return-rto-loss-calculator"), { href: "/calculators", label: "All 5 Calculators" }],
  },
  "break-even-price-calculator": {
    slug: "break-even-price-calculator",
    title: "Seller Break-even Price Calculator",
    description: "Estimate a marketplace-neutral break-even selling price from known costs, failure exposure and your observed retained payout rate.",
    eyebrow: "Universal seller calculator",
    headline: "What selling price covers your real unit economics?",
    intro: "Use product, packaging, ads, other variable costs, observed failure loss and your own retained payout rate.",
    directAnswer: "A safer break-even estimate divides the required unit economics by your observed retained payout rate. Use your own payout or settlement history rather than a hard-coded marketplace deduction percentage.",
    formula: "Approximate break-even price = required unit economics ÷ observed retained payout rate",
    example: "If required unit economics are ₹320 and your observed retained payout rate is 80%, approximate break-even price is ₹400.",
    toolType: "break-even",
    guideTitle: "Build price from your own evidence",
    guide: [
      "Include product, packaging, attributable ads and other supplied variable costs.",
      "Include expected failure loss only when the rate and average loss are evidence-backed.",
      "Use your observed retained payout rate instead of a hidden universal deduction percentage.",
    ],
    faqs: [
      ["Does this work across marketplaces?", "Yes. It uses your observed retained payout rate instead of assuming one platform fee structure."],
      ["Does break-even price guarantee profit?", "No. It is an analytical threshold based on the values and observed rate you supplied."],
      ["What if I do not know the retained payout rate?", "The calculator should remain incomplete rather than inventing one."],
    ],
    related: [...related("/break-even-price-calculator"), { href: "/calculators", label: "All 5 Calculators" }],
  },
  "max-acos-calculator": {
    slug: "max-acos-calculator",
    title: "Seller Max ACoS Calculator",
    description: "Calculate the maximum sustainable advertising cost of sales from attributable sales and pre-ad contribution for any marketplace.",
    eyebrow: "Universal ads calculator",
    headline: "What ACoS can your margin actually afford?",
    intro: "Marketplace-neutral ad math: use attributable ad sales and the contribution available before advertising.",
    directAnswer: "Maximum sustainable ACoS is the share of attributable ad sales that pre-ad contribution can absorb before contribution reaches zero. A practical operating target normally needs room below that ceiling.",
    formula: "Maximum sustainable ACoS = pre-ad contribution ÷ attributable ad sales × 100",
    example: "With ₹15,000 pre-ad contribution and ₹60,000 attributable ad sales, maximum sustainable ACoS is 25%.",
    toolType: "acos",
    guideTitle: "Set ad limits from contribution",
    guide: [
      "Use attributable sales from the same advertising window.",
      "Use pre-ad contribution, not gross revenue, as the money available to fund ads.",
      "If pre-ad contribution is zero or negative, paid scaling is not financially supportable from this evidence.",
    ],
    faqs: [
      ["Is this tied to one marketplace?", "No. The formula uses your own attributable sales and pre-ad contribution."],
      ["Is maximum ACoS the same as target ACoS?", "No. Maximum ACoS is a break-even ceiling; a target normally needs safety room below it."],
      ["Can I calculate this from revenue alone?", "No. Pre-ad contribution is required."],
    ],
    related: [...related("/max-acos-calculator"), { href: "/calculators", label: "All 5 Calculators" }],
  },
  "break-even-roas-calculator": {
    slug: "break-even-roas-calculator",
    title: "Seller Break-even ROAS Calculator",
    description: "Calculate marketplace-neutral break-even ROAS from attributable ad sales and pre-ad contribution.",
    eyebrow: "Universal ads calculator",
    headline: "What ROAS does your margin need to break even on ads?",
    intro: "Use the same contribution-based ROAS threshold across marketplaces without assuming platform-specific fee tables.",
    directAnswer: "Break-even ROAS is attributable ad sales divided by pre-ad contribution. A high revenue ROAS can still be economically weak when contribution before ads is thin.",
    formula: "Break-even ROAS = attributable ad sales ÷ pre-ad contribution",
    example: "With ₹60,000 attributable ad sales and ₹15,000 pre-ad contribution, break-even ROAS is 4.0x.",
    toolType: "roas",
    guideTitle: "Read ROAS together with margin",
    guide: [
      "Use attributable sales from the same ad window.",
      "Use pre-ad contribution as the amount available to pay for advertising.",
      "Treat break-even ROAS as a threshold, not a guarantee of final Net Profit.",
    ],
    faqs: [
      ["Does this work across marketplaces?", "Yes. It uses your own ad sales and contribution instead of marketplace-specific assumptions."],
      ["Is higher ROAS always profitable?", "No. Profitability depends on contribution before advertising, not revenue efficiency alone."],
      ["How does this relate to ACoS?", "Break-even ROAS and maximum sustainable ACoS are inverse views of the same pre-ad economics."],
    ],
    related: [...related("/break-even-roas-calculator"), { href: "/calculators", label: "All 5 Calculators" }],
  },
};
