import { calculatorCatalog } from "./calculator-catalog";
import { MARKETPLACE_DEFINITIONS, type MarketplaceExperienceId } from "./marketplace-definitions";
import type { SeoPageConfig, SeoToolType } from "./seo-pages";

export type MarketplaceCalculatorKind = "profit" | "failure" | "break-even" | "acos" | "roas";

export type MarketplaceCalculatorEntry = {
  marketplaceId: MarketplaceExperienceId;
  kind: MarketplaceCalculatorKind;
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  formula: string;
  tone: string;
};

export type MarketplaceCalculatorGroup = {
  marketplaceId: MarketplaceExperienceId;
  label: string;
  logo: string;
  summary: string;
  calculators: MarketplaceCalculatorEntry[];
};

type PlatformCopy = {
  id: Exclude<MarketplaceExperienceId, "meesho">;
  name: string;
  hubHref: string;
  guideHref: string;
  profitEvidence: string;
  failureName: string;
  failureTitle: string;
  retainedLabel: string;
  exactEvidenceHref: string;
  exactEvidenceLabel: string;
};

const PLATFORM_COPY: PlatformCopy[] = [
  {
    id: "amazon",
    name: "Amazon India",
    hubHref: "/marketplaces/amazon",
    guideHref: "/guides/amazon-india-profitability",
    profitEvidence: "Amazon Settlement Flat File V2 or another attributable settlement/payout amount from the same evidence window",
    failureName: "return/refund",
    failureTitle: "Amazon Return Loss Calculator",
    retainedLabel: "observed retained settlement rate",
    exactEvidenceHref: "/analyze",
    exactEvidenceLabel: "Analyze Amazon files",
  },
  {
    id: "flipkart",
    name: "Flipkart",
    hubHref: "/marketplaces/flipkart",
    guideHref: "/guides/flipkart-profitability",
    profitEvidence: "supported Flipkart settlement/P&L evidence attributable to the order or SKU",
    failureName: "return/RTO",
    failureTitle: "Flipkart RTO & Return Loss Calculator",
    retainedLabel: "observed retained settlement rate",
    exactEvidenceHref: "/analyze",
    exactEvidenceLabel: "Analyze Flipkart files",
  },
  {
    id: "shopify",
    name: "Shopify",
    hubHref: "/marketplaces/shopify",
    guideHref: "/guides/shopify-profitability",
    profitEvidence: "a supported Shopify Payments balance transaction or another actual net gateway payout attributable to the order",
    failureName: "return/refund",
    failureTitle: "Shopify Return & Refund Loss Calculator",
    retainedLabel: "observed net payout retained rate",
    exactEvidenceHref: "/analyze",
    exactEvidenceLabel: "Analyze Shopify files",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    hubHref: "/marketplaces/woocommerce",
    guideHref: "/guides/woocommerce-profitability",
    profitEvidence: "the actual payment-gateway or bank payout attributable to the order; WooCommerce order totals alone do not prove settlement",
    failureName: "return/refund",
    failureTitle: "WooCommerce Return & Refund Loss Calculator",
    retainedLabel: "observed net gateway payout retained rate",
    exactEvidenceHref: "/app/connections",
    exactEvidenceLabel: "Open WooCommerce connection",
  },
];

function related(copy: PlatformCopy, calculatorHref: string): Array<{ href: string; label: string }> {
  return [
    { href: copy.hubHref, label: `${copy.name} Seller Hub` },
    { href: copy.guideHref, label: `${copy.name} Profitability Guide` },
    { href: "/calculators", label: "All Calculators" },
    { href: copy.exactEvidenceHref, label: copy.exactEvidenceLabel },
    { href: calculatorHref, label: "Current calculator" },
  ];
}

function configFor(copy: PlatformCopy, kind: MarketplaceCalculatorKind, slug: string): SeoPageConfig {
  const hubRelated = (href: string) => related(copy, href).filter((item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index);

  if (kind === "profit") {
    return {
      slug,
      title: `${copy.name} Profit Calculator`,
      description: `Estimate ${copy.name} contribution from actual payout or settlement evidence and seller-entered costs without hiding marketplace fee assumptions.`,
      eyebrow: `${copy.name} calculator`,
      headline: `How much contribution did this ${copy.name} order actually leave?`,
      intro: `Start from ${copy.profitEvidence}, then subtract the costs you actually know.`,
      directAnswer: `Use ${copy.profitEvidence} as the money input. Subtract product cost, packaging, other variable costs and attributable ads. If payout/settlement evidence is missing, the result is only an estimate and should not be presented as confirmed Net Profit.`,
      formula: "Contribution = attributable net payout/settlement − product cost − packaging − other known variable costs − attributable ads",
      example: "If the attributable net payout is ₹540 and known variable costs total ₹410, contribution is ₹130. Fixed overhead and tax are still outside this quick calculation unless explicitly supplied.",
      toolType: "margin",
      guideTitle: `Use real ${copy.name} money evidence`,
      guide: [
        `Use ${copy.profitEvidence}.`,
        "Subtract only costs you actually know instead of inserting a hidden universal fee table.",
        "Keep missing payout, tax or fixed-overhead evidence visible instead of silently treating it as zero.",
      ],
      faqs: [
        ["Can I use gross sales as settlement?", "No. Gross order value and net marketplace or gateway payout answer different questions."],
        ["Is this Net Profit?", "Not automatically. This is a contribution estimate from the supplied variable economics."],
        ["Do I need a live marketplace connection?", copy.id === "woocommerce" ? "No. You can enter actual payout values manually; the WooCommerce connection reads orders and does not infer gateway settlement." : "No. The quick calculator works from values you enter, and supported file analysis remains separate from optional API connections."],
      ],
      related: hubRelated(`/${slug}`),
    };
  }

  if (kind === "failure") {
    return {
      slug,
      title: copy.failureTitle,
      description: `Estimate ${copy.name} ${copy.failureName} economic loss from observed order volume, failure rate and actual average loss.`,
      eyebrow: `${copy.name} calculator`,
      headline: `What are ${copy.name} ${copy.failureName} events costing you?`,
      intro: "Turn an observed failure percentage into a rupee exposure using your own loss evidence.",
      directAnswer: `Multiply the relevant shipped/order count by the observed ${copy.failureName} rate and the observed average economic loss per failed order. Do not invent damage, recovery or fee values that your source evidence does not prove.`,
      formula: "Estimated failure loss = orders × observed failure rate × observed average loss per failed order",
      example: "For 200 orders, a 9% observed failure rate and ₹80 average economic loss per failure, estimated exposure is ₹1,440.",
      toolType: "failure",
      guideTitle: "Measure the loss, not just the rate",
      guide: [
        "Use one consistent evidence period for order count and failure rate.",
        "Use observed average economic loss rather than a universal assumed charge.",
        "Cross-period refunds, adjustments or recoveries can still change the final result.",
      ],
      faqs: [
        ["Should missing recovery be assumed zero?", "No. Missing recovery evidence should remain an uncertainty rather than a hidden fact."],
        ["Can one failure percentage be called safe for every seller?", "No. Sustainability depends on successful-order contribution and the economic loss of a failed order."],
        ["Does this calculator need API access?", "No. It uses the numbers you enter in the browser."],
      ],
      related: hubRelated(`/${slug}`),
    };
  }

  if (kind === "break-even") {
    return {
      slug,
      title: `${copy.name} Break-even Price Calculator`,
      description: `Estimate a ${copy.name} break-even selling price from known costs, failure exposure and your own ${copy.retainedLabel}.`,
      eyebrow: `${copy.name} calculator`,
      headline: `What selling price covers your ${copy.name} economics?`,
      intro: `Use product, packaging, ads, other variable costs, observed failure loss and your ${copy.retainedLabel}.`,
      directAnswer: `A safer break-even estimate divides the required unit economics by the ${copy.retainedLabel}. The retained rate should come from your own payout or settlement history rather than a hard-coded marketplace fee assumption.`,
      formula: "Approximate break-even price = required unit economics ÷ observed retained payout/settlement rate",
      example: "If required unit economics are ₹320 and your observed retained payout rate is 80%, approximate break-even price is ₹400.",
      toolType: "break-even",
      guideTitle: "Build price from your own evidence",
      guide: [
        "Include product, packaging, attributable ads and other supplied variable costs.",
        "Include expected failure loss only when the rate and average loss are evidence-backed.",
        `Use your ${copy.retainedLabel} instead of a hidden universal deduction percentage.`,
      ],
      faqs: [
        ["Does break-even price guarantee profit?", "No. It is an analytical threshold based on the values and observed rate you supplied."],
        ["Can the retained rate change?", "Yes. Marketplace, gateway, return and advertising economics can change over time."],
        ["What if I do not know the retained rate?", "The calculator should remain incomplete rather than inventing one."],
      ],
      related: hubRelated(`/${slug}`),
    };
  }

  if (kind === "acos") {
    return {
      slug,
      title: `${copy.name} Max ACoS Calculator`,
      description: `Calculate the maximum sustainable ${copy.name} advertising cost of sales from attributable sales and pre-ad contribution.`,
      eyebrow: `${copy.name} ads calculator`,
      headline: `What ACoS can your ${copy.name} margin actually afford?`,
      intro: "Use attributable ad sales and the contribution available before advertising.",
      directAnswer: "Maximum sustainable ACoS is the share of attributable ad sales that pre-ad contribution can absorb before contribution reaches zero. A practical operating target usually needs room below that ceiling.",
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
        ["Is maximum ACoS the same as target ACoS?", "No. Maximum ACoS is a break-even ceiling; a target normally needs safety room below it."],
        ["Can I calculate this from revenue alone?", "No. Pre-ad contribution is required."],
        ["Does SellerHisab assume marketplace ad fees?", "No. The calculator uses the values you enter."],
      ],
      related: hubRelated(`/${slug}`),
    };
  }

  return {
    slug,
    title: `${copy.name} Break-even ROAS Calculator`,
    description: `Calculate break-even ${copy.name} ROAS from attributable ad sales and pre-ad contribution.`,
    eyebrow: `${copy.name} ads calculator`,
    headline: `What ROAS does your ${copy.name} margin need to break even on ads?`,
    intro: "Compare attributable ad sales with the contribution available before advertising.",
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
      ["Is higher ROAS always profitable?", "No. Profitability depends on contribution before advertising, not revenue efficiency alone."],
      ["What if pre-ad contribution is zero?", "There is no positive contribution available to fund ads, so a sustainable scale recommendation is not supportable."],
      ["How does this relate to ACoS?", "Break-even ROAS and maximum sustainable ACoS are inverse views of the same pre-ad economics."],
    ],
    related: hubRelated(`/${slug}`),
  };
}

function entry(
  marketplaceId: MarketplaceExperienceId,
  kind: MarketplaceCalculatorKind,
  slug: string,
  title: string,
  description: string,
  formula: string,
  tone: string,
): MarketplaceCalculatorEntry {
  const shortTitle = kind === "profit" ? "Profit" : kind === "failure" ? "Returns / RTO" : kind === "break-even" ? "Break-even" : kind === "acos" ? "Max ACoS" : "Break-even ROAS";
  return { marketplaceId, kind, slug, title, shortTitle, description, formula, tone };
}

const meeshoEntries: MarketplaceCalculatorEntry[] = calculatorCatalog.map((tool) => entry(
  "meesho",
  tool.id === "rto" ? "failure" : tool.id === "break-even" ? "break-even" : tool.id === "acos" ? "acos" : tool.id === "roas" ? "roas" : "profit",
  tool.href.slice(1),
  tool.title,
  tool.description,
  tool.formula,
  tool.tone,
));

const extraEntries: MarketplaceCalculatorEntry[] = PLATFORM_COPY.flatMap((copy) => {
  const definition = MARKETPLACE_DEFINITIONS[copy.id];
  const [profitSlug, failureSlug, breakEvenSlug, acosSlug, roasSlug] = definition.calculatorSlugs;
  return [
    entry(copy.id, "profit", profitSlug, `${copy.name} Profit Calculator`, `Estimate contribution from actual ${copy.name} payout/settlement evidence and known costs.`, "Net payout/settlement − known variable costs", "blue"),
    entry(copy.id, "failure", failureSlug, copy.failureTitle, `Translate observed ${copy.failureName} rate into a rupee exposure.`, "Orders × failure rate × loss per failure", "red"),
    entry(copy.id, "break-even", breakEvenSlug, `${copy.name} Break-even Price`, `Estimate the minimum selling price supported by your own costs and retained payout rate.`, "Required economics ÷ retained rate", "green"),
    entry(copy.id, "acos", acosSlug, `${copy.name} Max ACoS`, "See the maximum ad-cost percentage your pre-ad contribution can sustain.", "Pre-ad contribution ÷ ad sales", "amber"),
    entry(copy.id, "roas", roasSlug, `${copy.name} Break-even ROAS`, "Find the minimum ROAS supported by your pre-ad contribution.", "Ad sales ÷ pre-ad contribution", "violet"),
  ];
});

const allEntries = [...meeshoEntries, ...extraEntries];

export const marketplaceCalculatorGroups: MarketplaceCalculatorGroup[] = (["meesho", "amazon", "flipkart", "shopify", "woocommerce"] as MarketplaceExperienceId[]).map((marketplaceId) => {
  const definition = MARKETPLACE_DEFINITIONS[marketplaceId];
  return {
    marketplaceId,
    label: definition.name,
    logo: definition.logo,
    summary: definition.calculators.detail,
    calculators: allEntries.filter((item) => item.marketplaceId === marketplaceId),
  };
});

const configEntries: Array<[string, SeoPageConfig]> = PLATFORM_COPY.flatMap((copy) => {
  const slugs = MARKETPLACE_DEFINITIONS[copy.id].calculatorSlugs;
  const kinds: MarketplaceCalculatorKind[] = ["profit", "failure", "break-even", "acos", "roas"];
  return kinds.map((kind, index) => [slugs[index], configFor(copy, kind, slugs[index])]);
});

export const marketplaceSeoPages: Record<string, SeoPageConfig> = Object.fromEntries(configEntries);

export function calculatorEntryForSlug(slug: string): MarketplaceCalculatorEntry | undefined {
  return allEntries.find((item) => item.slug === slug);
}

export function calculatorGroupForSlug(slug: string): MarketplaceCalculatorGroup | undefined {
  const entry = calculatorEntryForSlug(slug);
  return entry ? marketplaceCalculatorGroups.find((group) => group.marketplaceId === entry.marketplaceId) : undefined;
}

export function calculatorToolType(kind: MarketplaceCalculatorKind): SeoToolType {
  if (kind === "profit") return "margin";
  if (kind === "failure") return "failure";
  if (kind === "break-even") return "break-even";
  if (kind === "acos") return "acos";
  return "roas";
}
