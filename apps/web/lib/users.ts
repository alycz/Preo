import { prisma } from "./prisma";

export function cantonPartyForDynamicUser(dynamicUserId: string) {
  return `preo-${dynamicUserId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export async function getRequiredUser(dynamicUserId: string) {
  const user = await prisma.user.findUnique({ where: { dynamicUserId } });
  if (!user) {
    throw new Error("User has not been bootstrapped");
  }
  return user;
}
