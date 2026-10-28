import { z } from "zod";
import { isPs5Pro } from "./match";

export type Listing = {
  retailer: string;
  title: string;
  url: string;
  price?: number;
  inStock: boolean;
};

export type Retailer = {
  name: string;
  /** Every PS5 Pro listing the retailer currently shows, in stock or not. */
  check: () => Promise<Listing[]>;
};

// JB Hi-Fi rate limits requests that do not look like a browser.
const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  "accept-language": "en-NZ,en;q=0.9",
  "sec-ch-ua": '"Chromium";v="141", "Google Chrome";v="141"',
  "sec-ch-ua-platform": '"macOS"',
};

type Request = { method?: "GET" | "POST"; headers?: Record<string, string>; body?: string };

// Goes through curl rather than fetch: PB Tech's Cloudflare rejects the TLS
// handshake of Bun and Node's fetch, but lets curl through.
async function get(url: string, { method = "GET", headers, body }: Request = {}) {
  const args = ["curl", "-sS", "-L", "--compressed", "--max-time", "30", "-X", method, "-w", "\n%{http_code}"];
  for (const [k, v] of Object.entries({ ...BROWSER_HEADERS, ...headers })) args.push("-H", `${k}: ${v}`);
  if (body) args.push("--data-binary", body);
  args.push(url);

  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const [out, err, exit] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (exit !== 0) throw new Error(`curl exited ${exit} for ${url}: ${err.trim()}`);

  const split = out.lastIndexOf("\n");
  const status = Number(out.slice(split + 1));
  if (status < 200 || status >= 300) throw new Error(`${status} from ${url}`);
  return out.slice(0, split);
}

// Reads the first schema.org availability on a product page. Both PB Tech
// (JSON-LD) and Harvey Norman (an inline analytics object) publish one.
const AVAILABILITY =
  /schema\.org\/(InStock|LimitedAvailability|OnlineOnly|PreOrder|PreSale|BackOrder|OutOfStock|SoldOut|Discontinued|InStoreOnly)/;
const BUYABLE = new Set(["InStock", "LimitedAvailability", "OnlineOnly", "PreOrder", "PreSale"]);

async function pageInStock(url: string) {
  const html = await get(url, { headers: { accept: "text/html" } });
  const availability = html.match(AVAILABILITY)?.[1];
  if (!availability) throw new Error(`No availability found on ${url}`);
  return BUYABLE.has(availability);
}

const ShopifySuggest = z.object({
  resources: z.object({
    results: z.object({
      products: z.array(
        z.object({ title: z.string(), handle: z.string(), available: z.boolean(), price: z.coerce.number() }),
      ),
    }),
  }),
});

// Shopify's predictive search. Stores tend to unpublish a sold-out PS5 Pro, so
// "no listing" and "listed but unavailable" both mean out of stock.
const shopify = (name: string, origin: string): Retailer => ({
  name,
  async check() {
    const url = new URL("/search/suggest.json", origin);
    url.searchParams.set("q", "ps5 pro");
    url.searchParams.set("resources[type]", "product");
    url.searchParams.set("resources[limit]", "10");
    const body = ShopifySuggest.parse(JSON.parse(await get(url.href, { headers: { accept: "application/json" } })));
    return body.resources.results.products
      .filter((p) => isPs5Pro(p.title))
      .map((p) => ({
        retailer: name,
        title: p.title,
        url: new URL(`/products/${p.handle}`, origin).href,
        price: p.price,
        inStock: p.available,
      }));
  },
});

const pbTech: Retailer = {
  name: "PB Tech",
  async check() {
    const html = await get("https://www.pbtech.co.nz/search?sf=ps5+pro+console", { headers: { accept: "text/html" } });
    // Product links look like `product/GAMSNY5604/Sony-PS5-PlayStation-5-Disc-Drive`.
    const products = new Map<string, string>();
    for (const [, code, slug] of html.matchAll(/href="product\/([A-Z0-9]+)\/([^"?]+)"/g)) {
      if (code && slug) products.set(code, slug);
    }
    const matches = [...products].filter(([, slug]) => isPs5Pro(slug.replaceAll("-", " ")));
    return Promise.all(
      matches.map(async ([code, slug]) => {
        const url = `https://www.pbtech.co.nz/product/${code}/${slug}`;
        return { retailer: "PB Tech", title: slug.replaceAll("-", " "), url, inStock: await pageInStock(url) };
      }),
    );
  },
};

const AttraqtSearch = z.object({
  items: z.array(
    z.object({ product: z.object({ title: z.string(), url: z.string(), price: z.number() }).optional() }),
  ),
});

// Harvey Norman's search box calls Attraqt directly with this public token.
const harveyNorman: Retailer = {
  name: "Harvey Norman",
  async check() {
    const res = await get("https://api-au.attraqt.io/search", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://www.harveynorman.co.nz" },
      body: JSON.stringify({ token: "6304ac34c9f6169067354b0e", query: "playstation 5 pro console", itemOptions: { limit: 20 } }),
    });
    const products = AttraqtSearch.parse(JSON.parse(res))
      .items.flatMap((i) => (i.product ? [i.product] : []))
      .filter((p) => isPs5Pro(p.title));
    return Promise.all(
      products.map(async (p) => ({
        retailer: "Harvey Norman",
        title: p.title,
        url: p.url,
        price: p.price,
        inStock: await pageInStock(p.url),
      })),
    );
  },
};

// Noel Leeming, The Warehouse and Mighty Ape sit behind Cloudflare or DataDome
// challenges that block non-browser clients, so they are not checked. EB Games
// NZ now redirects to the Australian store.
export const retailers: Retailer[] = [
  shopify("JB Hi-Fi", "https://www.jbhifi.co.nz"),
  shopify("Smiths City", "https://smithscity.co.nz"),
  shopify("Playtech", "https://www.playtech.co.nz"),
  shopify("Computer Lounge", "https://www.computerlounge.co.nz"),
  pbTech,
  harveyNorman,
];
