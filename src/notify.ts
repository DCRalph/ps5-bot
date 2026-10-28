import { z } from "zod";

// Sends through the Atmos notifications API (POST /api/v1/notifications/send)
// directly to one user. The key needs the `notifications:direct` scope.
const Env = z.object({
  ATMOS_API_KEY: z.string().startsWith("atmos_"),
  ATMOS_URL: z.url().default("https://atmosmedia.co.nz"),
  ATMOS_USER_ID: z.string().min(1).default("MC6FIGZYN7DOhlYaGmORFEyH2kmL1byf"),
});

export const loadNotifyConfig = () => Env.parse(process.env);
type NotifyConfig = ReturnType<typeof loadNotifyConfig>;

type Notification = {
  title: string;
  message: string;
  priority?: 1 | 2 | 3 | 4 | 5;
  click?: string;
  tags?: string[];
};

export async function notify(config: NotifyConfig, n: Notification) {
  const res = await fetch(new URL("/api/v1/notifications/send", config.ATMOS_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${config.ATMOS_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ to: { users: [config.ATMOS_USER_ID] }, ...n, title: n.title.slice(0, 120) }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Atmos notify failed: ${res.status} ${await res.text()}`);
}
