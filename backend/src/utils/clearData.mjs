import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function clearAllData() {
  console.log('Clearing all data for fresh start...')

  await prisma.aICommand.deleteMany()
  await prisma.aISession.deleteMany()
  await prisma.activityLog.deleteMany()
  await prisma.whatsAppMessage.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.certificate.deleteMany()
  await prisma.document.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.installment.deleteMany()
  await prisma.enrollment.deleteMany()
  await prisma.callLog.deleteMany()
  await prisma.note.deleteMany()
  await prisma.task.deleteMany()
  await prisma.lead.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.salaryRecord.deleteMany()

  console.log('All leads, students, payments, expenses cleared!')
  console.log('Users, courses, batches and settings kept intact')
}

clearAllData().catch(console.error).finally(() => prisma.$disconnect())
