import { prisma } from '../utils/prisma.js';
import { sendInstallmentReminder } from './whatsappService.js';
import { logger } from '../utils/logger.js';

export async function sendInstallmentReminders() {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const due = await prisma.installment.findMany({
      where: {
        status: { in: ['DUE', 'UPCOMING', 'OVERDUE'] },
        dueDate: { lte: tomorrow },
        reminderSentAt: null,
      },
      include: { enrollment: { include: { lead: true } } },
    });

    logger.info(`Sending reminders for ${due.length} installments`);
    for (const inst of due) {
      await sendInstallmentReminder(inst.id);
      await new Promise(r => setTimeout(r, 500));
    }

    // Mark overdue
    await prisma.installment.updateMany({
      where: { status: { in: ['DUE', 'UPCOMING'] }, dueDate: { lt: today } },
      data: { status: 'OVERDUE' },
    });

    logger.info(`Reminder cron complete`);
  } catch (err) {
    logger.error(`Reminder cron failed: ${err.message}`);
  }
}
