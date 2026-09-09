"use client";

import { extractMsg91AccessToken } from "@/core/auth/msg91";

type WidgetConfigResponse = {
  enabled: boolean;
  widgetId?: string;
  tokenAuth?: string;
  error?: string;
};

type Msg91Callback = (data: unknown) => void;

declare global {
  interface Window {
    initSendOTP?: (configuration: Record<string, unknown>) => void;
    sendOtp?: (identifier: string, success?: Msg91Callback, failure?: Msg91Callback) => void;
    verifyOtp?: (otp: string | number, success?: Msg91Callback, failure?: Msg91Callback, reqId?: string) => void;
    retryOtp?: (channel: string | null, success?: Msg91Callback, failure?: Msg91Callback, reqId?: string) => void;
  }
}

let initializationPromise: Promise<void> | null = null;
let initializedKey = "";

async function readConfig(): Promise<Required<Pick<WidgetConfigResponse, "widgetId" | "tokenAuth">>> {
  const response = await fetch("/api/config/auth-widget", { cache: "no-store" });
  const payload = await response.json() as WidgetConfigResponse;
  if (!response.ok || !payload.enabled || !payload.widgetId || !payload.tokenAuth) {
    throw new Error(payload.error ?? "Mobile OTP is not configured yet.");
  }
  return { widgetId: payload.widgetId, tokenAuth: payload.tokenAuth };
}

function loadProviderScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("OTP can only be used in the browser."));
  if (window.initSendOTP) return Promise.resolve();

  return new Promise((resolve, reject) => {
    // A CSP/network failure can leave a dead script element in the DOM.
    // Remove it before retrying so a later OTP click never waits forever.
    document.querySelector<HTMLScriptElement>('script[data-msg91-otp-provider="true"]')?.remove();

    const script = document.createElement("script");
    script.src = "https://verify.msg91.com/otp-provider.js";
    script.async = true;
    script.dataset.msg91OtpProvider = "true";

    const timeout = window.setTimeout(() => {
      script.remove();
      reject(new Error("MSG91 OTP service took too long to load. Please try again."));
    }, 12000);

    script.onload = () => {
      window.clearTimeout(timeout);
      if (typeof window.initSendOTP === "function") {
        resolve();
      } else {
        script.remove();
        reject(new Error("MSG91 OTP service loaded but did not initialize."));
      }
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error("Could not load MSG91 OTP service."));
    };
    document.head.appendChild(script);
  });
}

async function waitForMethods() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (typeof window.sendOtp === "function" && typeof window.verifyOtp === "function") return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("MSG91 OTP service did not initialize.");
}

export async function ensureMsg91WidgetReady(): Promise<void> {
  const config = await readConfig();
  const key = `${config.widgetId}:${config.tokenAuth}`;
  if (initializedKey === key && typeof window.sendOtp === "function" && typeof window.verifyOtp === "function") return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    await loadProviderScript();
    if (!window.initSendOTP) throw new Error("MSG91 OTP service is unavailable.");
    window.initSendOTP({
      widgetId: config.widgetId,
      tokenAuth: config.tokenAuth,
      exposeMethods: true,
      captchaRenderId: "smg-msg91-captcha",
      success: () => undefined,
      failure: () => undefined,
    });
    await waitForMethods();
    initializedKey = key;
  })().finally(() => {
    initializationPromise = null;
  });

  return initializationPromise;
}

export async function sendMsg91WidgetOtp(identifier: string): Promise<{ reqId?: string }> {
  await ensureMsg91WidgetReady();
  if (!window.sendOtp) throw new Error("MSG91 OTP service is unavailable.");

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("OTP request timed out. Please try again."));
    }, 20000);

    window.sendOtp!(
      identifier,
      (data) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve({ reqId: extractString(data, ["reqId", "req_id", "requestId", "request_id"]) });
      },
      (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error(readWidgetError(error, "OTP could not be sent.")));
      },
    );
  });
}

export async function verifyMsg91WidgetOtp(otp: string, reqId?: string): Promise<string> {
  await ensureMsg91WidgetReady();
  if (!window.verifyOtp) throw new Error("MSG91 OTP service is unavailable.");

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("OTP verification timed out. Please try again."));
    }, 20000);

    window.verifyOtp!(
      otp,
      (data) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        const token = extractMsg91AccessToken(data);
        if (!token) {
          reject(new Error("OTP was verified but MSG91 did not return an access token."));
          return;
        }
        resolve(token);
      },
      (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error(readWidgetError(error, "The OTP did not match or has expired.")));
      },
      reqId,
    );
  });
}

function extractString(value: unknown, keys: string[]): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === "string") return record[key] as string;
  }
  for (const nested of Object.values(record)) {
    const match = extractString(nested, keys);
    if (match) return match;
  }
  return undefined;
}

function readWidgetError(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  for (const key of ["message", "error", "description"]) {
    const text = record[key];
    if (typeof text === "string" && text.trim()) return text;
  }
  return fallback;
}
