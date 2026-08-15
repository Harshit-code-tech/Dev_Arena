import { prisma } from './src/db';

async function seed() {
  console.log('Clearing old data...');
  await prisma.blogPost.deleteMany({});
  await prisma.release.deleteMany({});
  await prisma.user.deleteMany({ where: { email: 'test@devarena.dev' } });

  console.log('Creating test user...');
  const user = await prisma.user.create({
    data: { name: 'Harshit Ghosh', username: 'harshit_test', email: 'test@devarena.dev', passwordHash: 'hash' }
  });

  console.log('Creating blog posts...');
  await prisma.blogPost.create({
    data: {
      title: 'Backend Integration: Building Real APIs',
      content: 'We finally moved away from hardcoded frontend data to real database-backed API endpoints.',
      isDraft: false,
      authorId: user.id
    }
  });
  await prisma.blogPost.create({
    data: {
      title: 'How Prisma makes Database Modeling Easy',
      content: 'Prisma schema is the single source of truth for our database...',
      isDraft: false,
      authorId: user.id
    }
  });

  console.log('Creating releases...');
  await prisma.release.create({
    data: {
      version: 'v2.1.0',
      title: 'Real API Endpoints Launched',
      summary: 'Added real backend endpoints for Blog and Releases.',
      releaseTag: 'New',
      changelogSpecs: ['Added /api/blog', 'Added /api/releases', 'Database migration applied']
    }
  });

  console.log('Seed complete!');
  // await prisma.$disconnect();
}
seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
