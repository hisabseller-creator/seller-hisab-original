"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { DEFAULT_LANGUAGE, messages, type Language, type MessageKey } from "@/core/i18n/messages";
import { DEFAULT_SITE_SETTINGS, parseSiteSettings, type SiteSettings } from "@/core/site-settings";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export type PublicSessionUser = { id: string; email: string | null; phone: string | null; createdAt: string; isAdmin: boolean };
type AccountContextValue = {
  user: PublicSessionUser | null;
  loading: boolean;
  hasPaidAccess: boolean;
  plan: string | null;
  refresh: () => Promise<void>;
};
type SiteSettingsContextValue = {
  settings: SiteSettings;
  setSettings: (settings: SiteSettings) => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);
const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [user, setUser] = useState<PublicSessionUser | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [hasPaidAccess, setHasPaidAccess] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);

  useEffect(() => {
    const saved = localStorage.getItem("smg-language");
    if (saved === "english" || saved === "hinglish") {
      const timer = window.setTimeout(() => setLanguageState(saved), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const refreshAccount = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const payload = await response.json() as { user?: PublicSessionUser | null };
      const nextUser = response.ok ? payload.user ?? null : null;
      setUser(nextUser);
      if (!nextUser) {
        setHasPaidAccess(false);
        setPlan(null);
        return;
      }
      const billingResponse = await fetch("/api/billing/status", { cache: "no-store" });
      const billing = await billingResponse.json() as {
        hasPaidAccess?: boolean;
        activePlan?: string;
        subscription?: { plan: string; status: string } | null;
      };
      setHasPaidAccess(Boolean(billingResponse.ok && billing.hasPaidAccess));
      setPlan(billingResponse.ok && billing.activePlan && billing.activePlan !== "free" ? billing.activePlan : null);
    } catch {
      setUser(null);
      setHasPaidAccess(false);
      setPlan(null);
    } finally {
      setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshAccount(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshAccount]);

  useEffect(() => {
    let active = true;
    fetch("/api/config/site", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() : DEFAULT_SITE_SETTINGS)
      .then((value) => { if (active) setSiteSettings(parseSiteSettings(value)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage: (next) => {
      setLanguageState(next);
      localStorage.setItem("smg-language", next);
    },
    t: (key) => messages[language][key],
  }), [language]);
  const accountValue = useMemo<AccountContextValue>(() => ({
    user,
    loading: accountLoading,
    hasPaidAccess,
    plan,
    refresh: refreshAccount,
  }), [accountLoading, hasPaidAccess, plan, refreshAccount, user]);
  const siteSettingsValue = useMemo<SiteSettingsContextValue>(() => ({
    settings: siteSettings,
    setSettings: setSiteSettings,
  }), [siteSettings]);

  return (
    <LanguageContext.Provider value={value}>
      <AccountContext.Provider value={accountValue}>
        <SiteSettingsContext.Provider value={siteSettingsValue}>
          {children}
          <Toaster position="top-right" richColors />
        </SiteSettingsContext.Provider>
      </AccountContext.Provider>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside Providers");
  return context;
}

export function useAccountStatus() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccountStatus must be used inside Providers");
  return context;
}

export function useSiteSettings() {
  const context = useContext(SiteSettingsContext);
  if (!context) throw new Error("useSiteSettings must be used inside Providers");
  return context;
}
