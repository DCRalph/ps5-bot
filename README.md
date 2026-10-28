# ps5-pro-watch

Checks NZ retailers for a PS5 Pro every 5 minutes and sends an Atmos push
notification when one comes into stock.

| Retailer        | How                                           |
| --------------- | --------------------------------------------- |
| JB Hi-Fi        | Shopify search suggest JSON                   |
| Smiths City     | Shopify search suggest JSON                   |
| Playtech        | Shopify search suggest JSON                   |
| Computer Lounge | Shopify search suggest JSON                   |
| PB Tech         | Search page, then the product page's JSON-LD  |
| Harvey Norman   | Attraqt search API, then the product page     |

Not checked: Noel Leeming, The Warehouse and Mighty Ape block non-browser
clients with Cloudflare and DataDome challenges. EB Games NZ now redirects to
the Australian site.

Each listing notifies once when it comes into stock. It notifies again only
after the retailer has shown it out of stock or pulled the listing. If a
retailer fails 6 checks in a row, you get one low-priority notification, so a
broken check does not look like "still sold out".

## Run

```bash
bun install
bun run check        # check every retailer once and print, no notification
bun run test-notify  # send one test notification
bun start            # watch
bun test
```

## Config

See `.env.example`. Set `ATMOS_API_KEY` (scope `notifications:direct`) and
`ATMOS_USER_ID`, the user who gets the alerts. To list user ids:

```bash
curl -H "Authorization: Bearer $ATMOS_API_KEY" https://atmosmedia.co.nz/api/v1/notifications/recipients
```

## Dokploy

Create an Application from this repo, Build Type **Dockerfile**. Set
`ATMOS_API_KEY` and `ATMOS_USER_ID` in Environment (`.env` is not copied into the image). It needs no domain or port. It
is a worker that only makes outbound requests. Run `bun run test-notify` once
from the container terminal to check the key works.
