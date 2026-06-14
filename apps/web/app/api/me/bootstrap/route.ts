import { bootstrapRequestSchema } from "@preo/shared";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { ensureBootstrappedUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, bootstrapRequestSchema);
    const { bootstrap } = await ensureBootstrappedUser(input);
    return ok(bootstrap);
  } catch (error) {
    return errorResponse(error);
  }
}
