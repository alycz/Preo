import { canton } from "@/lib/canton";
import { ok } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const health = await canton.health();
    const strictMissing = process.env.LIVE_CANTON_REQUIRED === "true" && !health.live;
    return ok({
      ...health,
      ok: health.ok && !strictMissing,
      message: strictMissing ? "LIVE_CANTON_REQUIRED=true but Canton live env is not configured." : health.message
    });
  } catch (error) {
    return ok({
      live: false,
      ok: false,
      apiVersion: process.env.CANTON_JSON_API_VERSION ?? "v2",
      packageIdPresent: Boolean(process.env.CANTON_PACKAGE_ID),
      baseUrlPresent: Boolean(process.env.CANTON_JSON_API_URL),
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
