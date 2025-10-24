import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createBook() {
  console.log('🔍 Checking for existing books...');

  const existingBook = await prisma.book.findFirst();

  if (existingBook) {
    console.log(`✅ Book already exists: ${existingBook.name}`);
    console.log(`   Owner: ${existingBook.ownerName}`);
    console.log(`   ID: ${existingBook.id}`);
    return;
  }

  console.log('📚 Creating new book...');

  const book = await prisma.book.create({
    data: {
      name: "Glenn's Personal & Business",
      ownerName: 'Glenn',
      description: 'Personal finances and Pet Behaviour Services accounting',
      currency: 'AUD',
      fiscalYearStart: '07-01', // Australia: 1 July
      country: 'AU',
      timezone: 'Australia/Melbourne',
    },
  });

  console.log(`✅ Created book: ${book.name}`);
  console.log(`   ID: ${book.id}`);
  console.log(`   Owner: ${book.ownerName}`);
  console.log(`   Fiscal Year Start: ${book.fiscalYearStart}`);
}

createBook()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to create book:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
