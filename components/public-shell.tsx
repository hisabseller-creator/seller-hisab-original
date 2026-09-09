import { SiteFooter } from "./site-footer";
import { FeatureTabs } from "./feature-tabs";
import { SiteHeader } from "./site-header";
import { WebsiteHeader } from "./website-header";

export function PublicShell({ children, legacy = false }: { children: React.ReactNode; legacy?: boolean }) {
  if (!legacy) return <div className="website-public"><a className="website-skip" href="#website-content">Skip to content</a><WebsiteHeader /><div id="website-content" tabIndex={-1}>{children}</div><SiteFooter /></div>;
  return (
    <div className="app-wallpaper min-h-screen overflow-x-hidden text-slate-950">
      <SiteHeader />
      <FeatureTabs />
      {children}
      <SiteFooter />
    </div>
  );
}
