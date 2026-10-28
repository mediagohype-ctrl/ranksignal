// Dev seed: one staff user + demo org/project. Login: demo@example.com / demo-password-123
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = "demo@example.com";
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Seed already applied.");
    return;
  }
  const user = await db.user.create({
    data: { email, name: "Demo Owner", passwordHash: await bcrypt.hash("demo-password-123", 12), emailVerified: true, isStaff: true },
  });
  const org = await db.organization.create({ data: { name: "Demo Workspace", planId: "growth" } });
  await db.membership.create({ data: { userId: user.id, organizationId: org.id, role: "owner" } });
  await db.subscription.create({
    data: { organizationId: org.id, planId: "growth", status: "active", provider: "razorpay", currentPeriodStart: new Date() },
  });
  await db.project.create({
    data: {
      organizationId: org.id,
      name: "Example Co",
      websiteUrl: "https://example.com",
      brandNames: ["Example Co", "ExampleCo"],
      categories: ["project management software"],
      audience: "Small business owners in India",
      countries: ["IN"],
      languages: ["en"],
      competitors: [{ name: "Acme Tasks", domain: "acme.test", aliases: [] }],
      keywords: ["project management tool", "task tracking for small teams"],
      settings: { maxPagesPerCrawl: 20, automation: { allowClassB: [] } },
    },
  });
  console.log("Seeded demo@example.com / demo-password-123");
}

main().finally(() => db.$disconnect());
