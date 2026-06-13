import { z } from "zod";
import { resetCantonDemoState } from "@preo/canton-client";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const demoResetRequestSchema = z.object({
  dynamicUserId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    if (process.env.DEMO_MODE !== "true" && process.env.CANTON_JSON_API_URL) {
      return ok({ error: "DEMO_MODE_DISABLED" }, { status: 403 });
    }

    const input = await parseJson(request, demoResetRequestSchema);
    const user = await prisma.user.findUnique({ where: { dynamicUserId: input.dynamicUserId } });
    if (user) {
      await prisma.agentAction.deleteMany({ where: { userId: user.id } });
      await prisma.fundingIntent.deleteMany({ where: { userId: user.id } });
      await prisma.evmEvent.deleteMany({ where: { userId: user.id } });
      await prisma.policyCache.deleteMany({ where: { userId: user.id } });
      await prisma.cantonContract.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.demoParty.deleteMany();
    resetCantonDemoState();

    return ok({ reset: true, dynamicUserId: input.dynamicUserId });
  } catch (error) {
    return errorResponse(error);
  }
}
