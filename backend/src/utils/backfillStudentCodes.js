// One-off backfill: assigns FO<FY>-#### (or FOI<FY>-#### for internship students)
// codes to existing enrollments that don't have one yet, ordered by enrolledAt,
// bucketed into the FY their enrollment date actually falls in. Seeds
// FinancialYearCounter so future enrollments continue the sequence without gaps
// or collisions. Safe to re-run — skips rows already coded.
import { prisma } from './prisma.js';
import { getFYCode } from './studentCode.js';

async function main() {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentCode: null },
    orderBy: { enrolledAt: 'asc' },
    select: { id: true, enrolledAt: true, course: { select: { courseId: true } } },
  });

  console.log(`Found ${enrollments.length} enrollment(s) without a student code.`);

  const counters = {};
  let assigned = 0;
  for (const enr of enrollments) {
    const fyCode = getFYCode(enr.enrolledAt);
    const isInternship = enr.course?.courseId === 'INTERNSHIP';
    const counterKey = isInternship ? `${fyCode}-INT` : fyCode;
    counters[counterKey] = (counters[counterKey] || 0) + 1;
    const prefix = isInternship ? 'FOI' : 'FO';
    const studentCode = `${prefix}${fyCode}-${String(counters[counterKey]).padStart(4, '0')}`;
    await prisma.enrollment.update({ where: { id: enr.id }, data: { studentCode } });
    assigned += 1;
  }

  for (const [counterKey, count] of Object.entries(counters)) {
    await prisma.financialYearCounter.upsert({
      where: { fyCode: counterKey },
      create: { fyCode: counterKey, counter: count },
      update: { counter: count },
    });
    console.log(`${counterKey}: ${count} student(s) numbered, counter set to ${count}`);
  }

  console.log(`Done. Assigned ${assigned} student code(s).`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
