import { prisma } from './prisma.js';
export async function logActivity(leadId, userId, action, details = {}) {
  try {
    await prisma.activityLog.create({ data: { leadId, userId, action, details } });
  } catch (e) { /* non-blocking */ }
}
