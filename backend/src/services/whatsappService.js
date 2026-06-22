import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { generateReceiptPDF } from './receiptService.js';

// Twilio WhatsApp integration has been removed.
// Receipts are now downloaded as PDF via GET /api/payments/:id/receipt
// Campaigns are stored in DB for manual sending.

export async function generateAndSaveReceipt(paymentId) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { enrollment: { include: { lead: true, course: true } }, collectedBy: { select: { name: true } } },
  });
  if (!payment) throw new Error('Payment not found');

  const { enrollment, amount, method, receiptNumber, paidAt, transactionId } = payment;
  const { lead, course } = enrollment;

  const pdfPath = await generateReceiptPDF({
    receiptNumber,
    studentName: lead.name,
    phone: lead.phone,
    courseName: course.name,
    amount,
    method,
    transactionId,
    paidAt,
    netFee: enrollment.netFee,
    paidTotal: enrollment.paidAmount,
    balance: enrollment.balanceDue,
    collectedBy: payment.collectedBy.name,
  });

  logger.info(`Receipt PDF generated: ${pdfPath}`);
  return pdfPath;
}

// Backward-compatible alias used in payments route
export const sendPaymentReceipt = generateAndSaveReceipt;

export async function sendInstallmentReminder(installmentId) {
  logger.info(`Installment reminder queued for ${installmentId} (manual WhatsApp required)`);
  return { success: true };
}

export async function sendCampaign(campaignId) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { leads: { select: { id: true, name: true, phone: true } } },
  });
  if (!campaign) throw new Error('Campaign not found');

  let queued = 0;
  for (const lead of campaign.leads) {
    const body = campaign.messageTemplate
      .replace('{name}', lead.name)
      .replace('{institute}', 'Future Optima IT Solutions');
    await prisma.whatsAppMessage.create({
      data: { leadId: lead.id, campaignId, to: lead.phone, body, status: 'QUEUED' },
    });
    queued++;
  }
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { sentAt: new Date(), totalSent: queued },
  });
  logger.info(`Campaign ${campaignId} queued ${queued} messages for manual sending`);
  return { sent: queued, failed: 0 };
}

export async function sendWhatsAppMessage(to, body) {
  logger.info(`WhatsApp message queued for ${to} (manual delivery required)`);
  return { success: true, sid: null };
}
