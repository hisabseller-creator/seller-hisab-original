"use client";

import { useEffect, useState } from "react";

export type PublicPricing = {
  actionReportPaise: number;
  starterMonthlyPaise: number;
  proMonthlyPaise: number;
};

const defaults: PublicPricing = { actionReportPaise: 4_900, starterMonthlyPaise: 9_900, proMonthlyPaise: 19_900 };

export function usePricing() {
  const [pricing, setPricing] = useState(defaults);
  useEffect(() => {
    let active = true;
    fetch("/api/config/pricing", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as PublicPricing : defaults)
      .then((value) => { if (active) setPricing(value); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return pricing;
}

export function displayRupees(paise: number) {
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(paise / 100)}`;
}
