import { expect, test } from "bun:test";
import { isPs5Pro } from "./match";

test("matches PS5 Pro consoles and bundles", () => {
  for (const title of [
    "PS5 PlayStation 5 Pro 2TB Console",
    "PlayStation 5 Pro Console",
    "Sony PlayStation5 Pro Digital Edition 2TB",
    "PS5 Pro Console + Astro Bot Bundle",
    "Sony PS5 PlayStation 5 Pro Console",
  ]) {
    expect(isPs5Pro(title), title).toBe(true);
  }
});

test("rejects accessories and other consoles", () => {
  for (const title of [
    "DOBE PlayStation PS5 / PS5 Pro Wall Mount Bracket",
    "DOBE PS5 Slim PS5 Pro Storage Case Black",
    "SanDisk Optimus GX Pro 850P NVMe SSD for PS5 Consoles (2TB)",
    "Razer Wolverine V2 Pro Wireless Gaming Controller for PlayStation 5 & PC",
    "PS5 PlayStation 5 Slim 1TB Console",
    "Vertical Stand for PS5 Pro Console",
    "PlayStation Disc Drive for PS5 Pro Console",
  ]) {
    expect(isPs5Pro(title), title).toBe(false);
  }
});
