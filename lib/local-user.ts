import { prisma } from "@/lib/prisma";

const LOCAL_EMAIL = "local@xuqiu.dev";

/** 单机模式：无登录时固定一个本地用户，模板均挂在此用户下 */
export async function getLocalUserId(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: LOCAL_EMAIL },
    create: { email: LOCAL_EMAIL },
    update: {},
  });
  return user.id;
}
