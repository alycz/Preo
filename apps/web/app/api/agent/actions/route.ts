import { errorResponse, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const dynamicUserId = new URL(request.url).searchParams.get("dynamicUserId");
    const where = dynamicUserId ? { user: { dynamicUserId } } : undefined;
    const actions = await prisma.agentAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 25
    });
    return ok({ actions });
  } catch (error) {
    return errorResponse(error);
  }
}
