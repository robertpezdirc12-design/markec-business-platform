import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL
  
  // Use Neon adapter on Cloudflare Workers (edge runtime)
  // or when DATABASE_URL points to Neon
  if (databaseUrl && (databaseUrl.includes('neon.tech') || databaseUrl.includes('neon'))) {
    // Configure Neon for Cloudflare Workers
    neonConfig.fetchConnectionCache = true
    
    const adapter = new PrismaNeon({ connectionString: databaseUrl })
    return new PrismaClient({ adapter })
  }
  
  // Default: use standard PrismaClient (Node.js runtime)
  return new PrismaClient()
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma