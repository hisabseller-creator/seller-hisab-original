import { seoPages } from "./seo-pages";
import { marketplaceSeoPages } from "./marketplace-calculators";
import { universalCalculatorSeoPages } from "./universal-calculators";

export const allSeoPages = {
  ...seoPages,
  ...marketplaceSeoPages,
  ...universalCalculatorSeoPages,
};
