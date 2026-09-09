const key = "05ebe68381cbbe4a4e91e8d84368e915";
const host = "sellerhisab.com";
const base = `https://${host}`;
const urls = process.argv.slice(2);

if (!urls.length) {
  console.error("Usage: pnpm seo:indexnow / /pricing /calculators ...");
  process.exit(1);
}

const urlList = [...new Set(urls.map((value) => value.startsWith("http") ? value : `${base}${value.startsWith("/") ? value : `/${value}`}`))];

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    host,
    key,
    keyLocation: `${base}/${key}.txt`,
    urlList,
  }),
});

console.log(`IndexNow HTTP ${response.status} for ${urlList.length} URL(s).`);
if (!response.ok) process.exit(1);
