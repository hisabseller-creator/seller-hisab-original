export const messages = {
  hinglish: {
    analyze: "Profit check करें",
    pricing: "Pricing",
    methodology: "Methodology",
    privacy: "Privacy",
    confirmed: "Confirmed Contribution",
    atRisk: "अभी risk पर",
    losingSkus: "Loss-making SKUs",
    needsReview: "Data / payment review",
    actions: "अब क्या करना चाहिए?",
    filesLocal: "Files आपके device पर ही रहती हैं",
    why: "Why?",
    all: "सब",
  },
  english: {
    analyze: "Check profit",
    pricing: "Pricing",
    methodology: "Methodology",
    privacy: "Privacy",
    confirmed: "Confirmed Contribution",
    atRisk: "Still at Risk",
    losingSkus: "Loss-making SKUs",
    needsReview: "Data / payment review",
    actions: "What should I do?",
    filesLocal: "Files stay on your device",
    why: "Why?",
    all: "All",
  },
} as const;

export type Language = keyof typeof messages;
export type MessageKey = keyof (typeof messages)["hinglish"];

// Developer hint: English is the first-visit language. The user's explicit
// choice is persisted in localStorage by the provider.
export const DEFAULT_LANGUAGE: Language = "english";
