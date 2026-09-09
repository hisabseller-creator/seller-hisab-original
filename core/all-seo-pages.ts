import { seoPages } from "./seo-pages";
import { marketplaceSeoPages } from "./marketplace-calculators";

export const allSeoPages = {
  ...seoPages,
  ...marketplaceSeoPages,
};
