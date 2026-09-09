import { describe, expect, it } from "vitest";
import { DEFAULT_LANGUAGE, messages } from "@/core/i18n/messages";

describe("language defaults", () => {
  it("opens in English for a first-time visitor", () => {
    expect(DEFAULT_LANGUAGE).toBe("english");
    expect(messages[DEFAULT_LANGUAGE].analyze).toBe("Check profit");
  });

  it("keeps English terms and renders Hindi words in Devanagari", () => {
    expect(messages.hinglish.analyze).toBe("Profit check करें");
    expect(messages.hinglish.filesLocal).toMatch(/[\u0900-\u097f]/);
  });
});
