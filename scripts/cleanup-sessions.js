import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupExpiredSessions() {
  try {
    console.log('Starting session cleanup...');
    
    // Delete expired sessions
    const result = await prisma.session.deleteMany({
      where: {
        expires: {
          lt: new Date()
        }
      }
    });
    
    console.log(`Deleted ${result.count} expired sessions`);
    
    // Count remaining sessions
    const remainingCount = await prisma.session.count();
    console.log(`${remainingCount} sessions remaining`);
    
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupExpiredSessions();