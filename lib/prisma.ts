import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL 未配置。请在 .env 中设置 PostgreSQL 连接串，例如：postgresql://xuqiu:xuqiu@localhost:5432/xuqiu",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/** 开发热更新后 global 可能仍持有旧 Client（缺少新 model），需重建 */
function getPrisma(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && "aiProvider" in cached) {
    return cached;
  }
  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

export const prisma = getPrisma();
