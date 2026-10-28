import { loadNotifyConfig, notify } from "./notify";
import { retailers, type Listing } from "./retailers";

// `bun src/index.ts`              watch forever, notifying on restock
// `bun src/index.ts --once`       check every retailer once and print, no notifications
// `bun src/index.ts --test-notify` send one test notification and exit

const INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MINUTES ?? 5) * 60_000;
// After this many failed checks in a row, say so once, so a broken scraper
// does not look like "still out of stock".
const FAILURE_ALERT_AFTER = 6;

const price = (l: Listing) => (l.price ? ` $${l.price.toFixed(2)}` : "");

async function checkAll() {
  return Promise.all(
    retailers.map(async (r) => {
      try {
        return { retailer: r.name, listings: await r.check() };
      } catch (error) {
        return { retailer: r.name, error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );
}

if (process.argv.includes("--once")) {
  for (const result of await checkAll()) {
    if ("error" in result) console.log(`${result.retailer}: ERROR ${result.error}`);
    else if (!result.listings.length) console.log(`${result.retailer}: no PS5 Pro listed`);
    else
      for (const l of result.listings)
        console.log(`${l.retailer}: ${l.inStock ? "IN STOCK" : "out of stock"}${price(l)} ${l.title} ${l.url}`);
  }
  process.exit(0);
}

const config = loadNotifyConfig();

if (process.argv.includes("--test-notify")) {
  await notify(config, { title: "PS5 Pro watch", message: "Test notification. The bot can reach you.", priority: 3 });
  console.log("Sent.");
  process.exit(0);
}

// Listing URL -> retailer, for listings we have already notified about. A URL
// leaves when its retailer shows it out of stock or stops listing it, so the
// next restock notifies again.
const notified = new Map<string, string>();
const failures = new Map<string, number>();

async function tick() {

  const allResults = await checkAll();
  console.log(allResults);
  for (const result of allResults) {
    if ("error" in result) {
      const count = (failures.get(result.retailer) ?? 0) + 1;
      failures.set(result.retailer, count);
      console.error(`${result.retailer}: ${result.error} (${count} in a row)`);
      if (count === FAILURE_ALERT_AFTER) {
        await notify(config, {
          title: `PS5 Pro watch: ${result.retailer} check failing`,
          message: `${count} failed checks in a row. Last error: ${result.error}`,
          priority: 2,
        }).catch((e) => console.error(e));
      }
      continue;
    }
    failures.delete(result.retailer);

    const available = result.listings.filter((l) => l.inStock);
    for (const [url, retailer] of notified) {
      if (retailer === result.retailer && !available.some((l) => l.url === url)) notified.delete(url);
    }
    for (const l of available) {
      if (notified.has(l.url)) continue;
      console.log(`IN STOCK at ${l.retailer}: ${l.title}${price(l)} ${l.url}`);
      try {
        await notify(config, {
          title: `PS5 Pro in stock at ${l.retailer}`,
          message: `${l.title}${price(l)}`,
          priority: 5,
          click: l.url,
          tags: ["video_game"],
        });
        notified.set(l.url, l.retailer);
      } catch (e) {
        console.error(e); // not marked as notified, so the next tick retries
      }
    }
  }
}

console.log(`Watching ${retailers.map((r) => r.name).join(", ")} every ${INTERVAL_MS / 60_000} min`);
while (true) {
  await tick();
  // Jitter so requests do not land on the same second every time.
  await Bun.sleep(INTERVAL_MS + Math.random() * 30_000);
}
