// One-off: apply the July 2026 course fee revision and replace Vibe Coding & SaaS
// Development with Mearn Stack Development. Safe to re-run.
import { prisma } from './prisma.js';

async function main() {
  const updates = [
    { courseId: 'DATA_SCIENCE_AI', fees: 53000, name: 'Data Science with AI' },
    { courseId: 'AI_ENGINEERING', fees: 64000 },
    { courseId: 'AI_CYBERSECURITY', fees: 45000 },
    { courseId: 'BUSINESS_ANALYTICS', fees: 20000 },
    { courseId: 'DATA_ANALYTICS', fees: 46000, name: 'Data Analytics with AI' },
    { courseId: 'INTERNSHIP', fees: 5000, duration: '15 days - 1 month' },
    { courseId: 'PYTHON_FULLSTACK', fees: 42000 },
  ];

  for (const { courseId, ...data } of updates) {
    const r = await prisma.course.updateMany({ where: { courseId }, data });
    console.log(`${courseId}:`, r.count ? 'updated' : 'not found', data);
  }

  const vibe = await prisma.course.findFirst({ where: { courseId: 'VIBE_CODING_SAAS' } });
  if (vibe) {
    await prisma.course.update({
      where: { id: vibe.id },
      data: {
        courseId: 'MERN_STACK',
        name: 'Mearn Stack Development',
        shortName: 'MERN Stack',
        fees: 44000,
        highlights: ['MongoDB & Express', 'React Frontend', 'Node.js APIs', 'Full Project Deployment'],
      },
    });
    console.log('VIBE_CODING_SAAS -> MERN_STACK: converted');
  } else {
    console.log('VIBE_CODING_SAAS: no existing row found (already converted or never seeded)');
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
