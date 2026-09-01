const {
  InspectionStatus,
  PrismaClient,
  UserRole,
} = require("@prisma/client");
const { hashPassword } = require("../src/utils/password");

const prisma = new PrismaClient();

const demoUsers = [
  {
    email: "admin.demo@property-findings.local",
    password: "AdminDemo123!",
    role: UserRole.ADMIN,
  },
  {
    email: "inspector.demo@property-findings.local",
    password: "InspectorDemo123!",
    role: UserRole.INSPECTOR,
  },
  {
    email: "reviewer.demo@property-findings.local",
    password: "ReviewerDemo123!",
    role: UserRole.REVIEWER,
  },
];

const demoProperties = [
  {
    id: "demo-property-maple-court",
    name: "Maple Court Apartments",
    address: "1842 Maple Avenue, Chicago, IL 60614",
  },
  {
    id: "demo-property-lakeside-terrace",
    name: "Lakeside Terrace",
    address: "7250 North Sheridan Road, Chicago, IL 60626",
  },
];

const demoInspections = [
  {
    id: "demo-inspection-maple-2026-08",
    propertyId: "demo-property-maple-court",
    status: InspectionStatus.IN_PROGRESS,
    completedAt: null,
    inspectedAt: new Date("2026-08-15T15:00:00.000Z"),
  },
  {
    id: "demo-inspection-lakeside-2026-08",
    propertyId: "demo-property-lakeside-terrace",
    status: InspectionStatus.IN_PROGRESS,
    completedAt: null,
    inspectedAt: new Date("2026-08-22T18:30:00.000Z"),
  },
];

async function main() {
  const usersWithHashes = await Promise.all(
    demoUsers.map(async (user) => ({
      ...user,
      passwordHash: await hashPassword(user.password),
    })),
  );

  await prisma.$transaction(async (tx) => {
    const seededUsers = {};

    for (const { email, passwordHash, role } of usersWithHashes) {
      const user = await tx.user.upsert({
        where: { email },
        update: { passwordHash, role },
        create: { email, passwordHash, role },
      });

      seededUsers[role] = user;
    }

    for (const property of demoProperties) {
      await tx.property.upsert({
        where: { id: property.id },
        update: { name: property.name, address: property.address },
        create: property,
      });
    }

    const inspectorId = seededUsers[UserRole.INSPECTOR].id;

    for (const property of demoProperties) {
      await tx.propertyInspector.upsert({
        where: {
          propertyId_inspectorId: {
            propertyId: property.id,
            inspectorId,
          },
        },
        update: {},
        create: { propertyId: property.id, inspectorId },
      });
    }

    for (const inspection of demoInspections) {
      await tx.inspection.upsert({
        where: { id: inspection.id },
        update: {
          propertyId: inspection.propertyId,
          inspectorId,
          status: inspection.status,
          completedAt: inspection.completedAt,
          inspectedAt: inspection.inspectedAt,
        },
        create: { ...inspection, inspectorId },
      });
    }
  });

  console.log("Development seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Development seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
