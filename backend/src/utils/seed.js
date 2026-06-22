import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Future Optima CRM...');

  // Super Admin — Future Optima
  const adminHash = await bcrypt.hash('FutureOptima@2025', 12);
  await prisma.user.upsert({
    where: { email: 'admin@futureoptima.in' },
    update: { passwordHash: adminHash, name: 'Future Optima Admin', role: 'SUPER_ADMIN' },
    create: { name: 'Future Optima Admin', email: 'admin@futureoptima.in', passwordHash: adminHash, role: 'SUPER_ADMIN' },
  });

  // Legacy admin for backward compatibility
  const legacyHash = await bcrypt.hash('Admin@123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@nexora.ai' },
    update: {},
    create: { name: 'Nexora Admin', email: 'admin@nexora.ai', passwordHash: legacyHash, role: 'SUPER_ADMIN' },
  });

  // Counselor
  const counselorHash = await bcrypt.hash('Counselor@123', 12);
  await prisma.user.upsert({
    where: { email: 'counselor@futureoptima.in' },
    update: {},
    create: { name: 'Rahul Menon', email: 'counselor@futureoptima.in', passwordHash: counselorHash, role: 'COUNSELOR' },
  });

  // Courses
  const courses = [
    { courseId: 'AI_ENGINEERING', name: 'Professional AI Engineering & Automation Programme', shortName: 'AI Eng', duration: '6 months', totalHours: 360, fees: 75000, highlights: ['LLMs & Prompt Engineering', 'AI Agents & Automation', 'MLOps & Deployment', 'Real-world Projects'] },
    { courseId: 'DATA_SCIENCE_AI', name: 'Data Science with AI', shortName: 'DS+AI', duration: '5 months', totalHours: 300, fees: 60000, highlights: ['Python & Statistics', 'Machine Learning', 'Deep Learning', 'Industry Projects'] },
    { courseId: 'AI_CYBERSECURITY', name: 'AI-Powered Cybersecurity', shortName: 'AI CyberSec', duration: '4 months', totalHours: 240, fees: 65000, highlights: ['Ethical Hacking', 'AI Threat Detection', 'SOC Operations', 'Certifications'] },
    { courseId: 'PYTHON_FULLSTACK', name: 'Python Full Stack with AI', shortName: 'Python FS', duration: '5 months', totalHours: 320, fees: 55000, highlights: ['Django & FastAPI', 'React Frontend', 'AI Integration', 'Cloud Deployment'] },
    { courseId: 'VIBE_CODING_SAAS', name: 'Vibe Coding & SaaS Development', shortName: 'Vibe+SaaS', duration: '4 months', totalHours: 260, fees: 58000, highlights: ['No-Code + Code Hybrid', 'SaaS Architecture', 'Stripe Payments', 'Launch & Scale'] },
    { courseId: 'DATA_ANALYTICS', name: 'Data Analytics', shortName: 'Data Analytics', duration: '3 months', totalHours: 180, fees: 35000, highlights: ['Excel & SQL', 'Power BI & Tableau', 'Python Analytics', 'Dashboards'] },
    { courseId: 'BUSINESS_ANALYTICS', name: 'Business Analytics', shortName: 'Biz Analytics', duration: '3 months', totalHours: 180, fees: 38000, highlights: ['Business Intelligence', 'Forecasting', 'Data Storytelling', 'MBA-level Case Studies'] },
  ];

  for (const c of courses) {
    await prisma.course.upsert({ where: { courseId: c.courseId }, update: {}, create: c });
  }

  // System settings
  const settings = [
    { key: 'crm_name', value: 'Future Optima CRM' },
    { key: 'institute_name', value: 'Future Optima IT Solutions' },
    { key: 'whatsapp_enabled', value: 'false' },
    { key: 'ai_scoring_enabled', value: 'true' },
  ];
  for (const s of settings) {
    await prisma.systemSettings.upsert({ where: { key: s.key }, update: { value: s.value }, create: s });
  }

  console.log('✅ Seed complete!');
  console.log('👤 Admin: admin@futureoptima.in / FutureOptima@2025');
  console.log('👤 Counselor: counselor@futureoptima.in / Counselor@123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
