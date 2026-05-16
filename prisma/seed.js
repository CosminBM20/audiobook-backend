// backend/prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Începem popularea bazei de date...');

  // 1. Creăm câteva categorii
  const sf = await prisma.category.upsert({
    where: { name: 'Science Fiction' },
    update: {},
    create: { name: 'Science Fiction' },
  });

  const dezvoltarePersonala = await prisma.category.upsert({
    where: { name: 'Dezvoltare Personală' },
    update: {},
    create: { name: 'Dezvoltare Personală' },
  });

  // 2. Creăm un autor
  const autor = await prisma.author.create({
    data: {
      name: 'Frank Herbert'
    }
  });

  console.log('Datele au fost adăugate cu succes!');
  console.log('Categorii:', sf, dezvoltarePersonala);
  console.log('Autor:', autor);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });