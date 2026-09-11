"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ShieldCheck } from "lucide-react";
import styles from "./auth-lottie.module.css";

type LottieAnimation = { destroy: () => void };
type LottieApi = { loadAnimation: (options: { container: Element; renderer: "svg"; loop: boolean; autoplay: boolean; path: string; rendererSettings?: { preserveAspectRatio?: string } }) => LottieAnimation };

declare global {
  interface Window { lottie?: LottieApi }
}

const LOTTIE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js";
const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const getReducedMotion = () => window.matchMedia(motionQuery).matches;
const serverReducedMotion = () => true;

export function AuthLottie() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getReducedMotion, serverReducedMotion);

  useEffect(() => {
    if (reducedMotion || failed) return;
    let animation: LottieAnimation | undefined;
    let cancelled = false;
    let script: HTMLScriptElement | null = null;
    const onError = () => { if (!cancelled) setFailed(true); };

    const mount = () => {
      if (cancelled || !containerRef.current || !window.lottie) return;
      containerRef.current.replaceChildren();
      animation = window.lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
        path: "/login-animation.json",
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
      });
    };

    if (window.lottie) {
      mount();
    } else {
      script = document.querySelector<HTMLScriptElement>(`script[src="${LOTTIE_CDN}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = LOTTIE_CDN;
        script.async = true;
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
      }
      script.addEventListener("load", mount, { once: true });
      script.addEventListener("error", onError, { once: true });
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", mount);
      script?.removeEventListener("error", onError);
      animation?.destroy();
    };
  }, [reducedMotion, failed]);

  if (failed || reducedMotion) {
    return <div role="img" aria-label="Secure OTP sign-in illustration" className={`${styles.canvas} grid place-items-center`}><span className="liquid-icon grid size-20 place-items-center rounded-[24px] text-blue-600"><ShieldCheck aria-hidden="true" className="size-10" /></span></div>;
  }

  return <div ref={containerRef} className={`${styles.canvas} mx-auto`} role="img" aria-label="Secure OTP sign-in illustration" />;
}
