import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson } from "@/server/crypto";

describe("F6 connector credential encryption", () => {
  it("encrypts and decrypts connector tokens without plaintext storage", async () => {
    const secret = "sellerhisab-test-connector-key-with-at-least-32-characters";
    const credential = { provider: "shopify", accessToken: "shpat_test_secret", refreshToken: "refresh_secret" };
    const encrypted = await encryptJson(credential, secret);
    expect(encrypted.ciphertext).not.toContain("shpat_test_secret");
    expect(encrypted.iv).not.toHaveLength(0);
    await expect(decryptJson(encrypted.ciphertext, encrypted.iv, secret)).resolves.toEqual(credential);
  });

  it("rejects tampered encrypted connector credentials", async () => {
    const secret = "sellerhisab-test-connector-key-with-at-least-32-characters";
    const encrypted = await encryptJson({ accessToken: "secret" }, secret);
    const first = encrypted.ciphertext[0] === "A" ? "B" : "A";
    const tampered = first + encrypted.ciphertext.slice(1);
    await expect(decryptJson(tampered, encrypted.iv, secret)).rejects.toThrow();
  });
});
