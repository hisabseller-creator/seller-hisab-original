import { INDEXNOW_KEY, INDEXNOW_KEY_LOCATION } from "@/core/indexnow";
import { absoluteUrl } from "@/core/seo";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export async function submitIndexNow(paths: string[]) {
  const urlList = [...new Set(paths.map((path) => absoluteUrl(path)))].slice(0, 10_000);
  if (!urlList.length) return { submitted: 0, ok: true };

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        host: "sellerhisab.com",
        key: INDEXNOW_KEY,
        keyLocation: INDEXNOW_KEY_LOCATION,
        urlList,
      }),
    });
    return { submitted: urlList.length, ok: response.ok, status: response.status };
  } catch {
    // IndexNow is a discovery hint. Publishing must not fail because the external
    // notification endpoint is temporarily unavailable.
    return { submitted: urlList.length, ok: false, status: 0 };
  }
}
