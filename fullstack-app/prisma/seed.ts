import {PrismaClient} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check if GlobalSettings already has data
  const settingsCount = await prisma.globalSettings.count();

  if (settingsCount === 0) {
    console.log('Seeding GlobalSettings with default values...');

    // Create the default GlobalSettings record with default values
    await prisma.globalSettings.create({
      data: {},
    });

    console.log('GlobalSettings seeded successfully.');
  } else {
    console.log('GlobalSettings already has data, skipping seeding.');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
