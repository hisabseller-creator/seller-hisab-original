import {providerFetch} from "./provider-http";
import { normalizeIndiaMobile } from "@/core/auth/phone";
import { collectMsg91VerifiedPhones } from "@/core/auth/msg91-identity";
import { runtimeEnv } from "./runtime";

type ProviderPayload = Record<string, unknown>;

type ProviderResult = {
  response: Response;
  payload: ProviderPayload;
  transport: "control-form" | "api-json";
};

export async function verifyMsg91WidgetAccessToken(accessToken: string, expectedPhone: string): Promise<void> {
  const env = runtimeEnv();
  const authkey = env.MSG91_AUTH_KEY?.trim();
  if (!authkey) throw new Error("MSG91 server verification is not configured.");

  const normalizedExpected = normalizeIndiaMobile(expectedPhone);
  // Prefer the current documented API host, while retaining the established
  // control.msg91.com form route as a compatibility fallback.
  const attempts = [verifyAccessTokenApiJson, verifyAccessTokenControlForm];
  const providerErrors: string[] = [];
  let successfulVerificationWithoutIdentity = false;

  for (const attempt of attempts) {
    let result: ProviderResult;
    try {
      result = await attempt(authkey, accessToken);
    } catch (error) {
      providerErrors.push(error instanceof Error ? error.message : "MSG91 verification request failed.");
      continue;
    }

    if (!result.response.ok || providerLooksLikeFailure(result.payload)) {
      providerErrors.push(readProviderError(result.payload, `MSG91 ${result.transport} verification failed.`));
      continue;
    }

    const verifiedPhones = collectMsg91VerifiedPhones(result.payload, accessToken);
    if (verifiedPhones.has(normalizedExpected)) return;

    if (verifiedPhones.size > 0) {
      // A provider-verified token explicitly bound to another number must never
      // be accepted by trying another transport shape.
      throw new Error("The verified mobile number did not match this registration request.");
    }

    successfulVerificationWithoutIdentity = true;
  }

  if (successfulVerificationWithoutIdentity) {
    // Fail closed. A valid token alone is not enough to bind a browser-supplied
    // phone number to an account; SellerHisab must see that identity in trusted
    // MSG91 verification evidence (response or verified JWT payload).
    throw new Error("MSG91 verified the OTP but did not expose a server-verifiable mobile identity. Please request a fresh OTP and try again.");
  }

  throw new Error(providerErrors.find(Boolean) ?? "MSG91 could not validate this OTP verification.");
}

async function verifyAccessTokenApiJson(authkey: string, accessToken: string): Promise<ProviderResult> {
  const response = await providerFetch("https://api.msg91.com/api/v5/widget/verifyAccessToken", {
    method: "POST",
    headers: {
      accept: "application/json",
      authkey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ "access-token": accessToken }),
  });

  return { response, payload: await safeJson(response), transport: "api-json" };
}

async function verifyAccessTokenControlForm(authkey: string, accessToken: string): Promise<ProviderResult> {
  const body = new URLSearchParams();
  body.set("authkey", authkey);
  body.set("access-token", accessToken);

  const response = await providerFetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  return { response, payload: await safeJson(response), transport: "control-form" };
}

function providerLooksLikeFailure(payload: ProviderPayload) {
  const type = typeof payload.type === "string" ? payload.type : "";
  const message = typeof payload.message === "string" ? payload.message : "";
  const success = payload.success;
  return /error|fail|invalid|expired/i.test(`${type} ${message}`) || success === false;
}

async function safeJson(response: Response): Promise<ProviderPayload> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? parsed as ProviderPayload : { message: String(parsed) };
  } catch {
    return { message: text.slice(0, 1000) };
  }
}

function readProviderError(payload: ProviderPayload, fallback: string) {
  for (const key of ["message", "error", "description", "detail"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}
