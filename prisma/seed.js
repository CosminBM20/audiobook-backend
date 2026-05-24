const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Find any admin user to use as createdById
async function findOrCreateSeedAdmin() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (admin) return admin.id;
  // If no admin exists, find any user
  const user = await prisma.user.findFirst();
  if (user) return user.id;
  throw new Error('No users in DB — register at least one user before seeding challenges');
}

const challengeDefs = [
  {
    title: 'Prima carte',
    titleEn: 'First Book',
    description: 'Finalizează prima ta carte audio',
    descriptionEn: 'Complete your first audiobook',
    type: 'BOOKS_COMPLETED', difficulty: 'EASY', target: 1,
    period: 'ONE_TIME', xpReward: 50, badgeIcon: '🎯', isActive: true,
  },
  {
    title: 'Cititor pasionat',
    titleEn: 'Avid Reader',
    description: 'Finalizează 5 cărți audio',
    descriptionEn: 'Complete 5 audiobooks',
    type: 'BOOKS_COMPLETED', difficulty: 'MEDIUM', target: 5,
    period: 'ONE_TIME', xpReward: 150, badgeIcon: '📚', isActive: true,
  },
  {
    title: 'Maraton audio',
    titleEn: 'Audio Marathon',
    description: 'Ascultă 5 ore de conținut audio',
    descriptionEn: 'Listen to 5 hours of audio content',
    type: 'LISTENING_TIME', difficulty: 'HARD', target: 300,
    period: 'ONE_TIME', xpReward: 250, badgeIcon: '⏱️', isActive: true,
  },
];

async function main() {
  const createdById = await findOrCreateSeedAdmin();
  for (const def of challengeDefs) {
    const existing = await prisma.challenge.findFirst({ where: { title: def.title } });
    if (existing) {
      await prisma.challenge.update({
        where: { id: existing.id },
        data: { titleEn: def.titleEn, descriptionEn: def.descriptionEn },
      });
      console.log(`Updated: ${def.title}`);
    } else {
      await prisma.challenge.create({ data: { ...def, createdById } });
      console.log(`Created: ${def.title}`);
    }
  }
  console.log('Done.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(err => { console.error(err); prisma.$disconnect(); process.exit(1); });
