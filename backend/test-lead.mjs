import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const lead = await p.lead.create({
    data: {
      name: 'Test Lead',
      phone: '9876543210',
      source: 'WALK_IN',
      status: 'NEW'
    }
  });
  console.log('Lead created:', lead.id);
}

main().catch(e => console.log('Error:', e.message)).finally(() => p.$disconnect());
