// Decides whether a retailer's product title is a PS5 Pro console (or a bundle
// with one), as opposed to the many accessories that mention "PS5 Pro".

const PS5_PRO = /\b(ps5|playstation\s*5)\s*pro\b/i;
const CONSOLE = /\b(console|bundle|2tb)\b/i;
const ACCESSORY =
  /\b(stand|case|cover|skin|controller|charg\w*|dock|mount|bracket|cool\w*|ssd|cable|bag|headset|wheel|hub|faceplate|plates?|protect\w*|dust|warranty|disc drive|vertical|storage)\b/i;

export const isPs5Pro = (title: string) =>
  PS5_PRO.test(title) && CONSOLE.test(title) && !ACCESSORY.test(title);
