// Indian financial year runs April 1 - March 31.
export function getFYCode(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? year : year - 1; // April = month index 3
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
}

// Must be called inside a prisma $transaction (tx) — atomically increments the
// per-FY counter so concurrent enrollments never get the same student code.
// Internship students get their own "FOI" series (separate counter bucket) so
// their numbers never collide or interleave with regular course students' "FO" series.
export async function nextStudentCode(tx, enrolledAt, isInternship = false) {
  const fyCode = getFYCode(enrolledAt || new Date());
  const counterKey = isInternship ? `${fyCode}-INT` : fyCode;
  const { counter } = await tx.financialYearCounter.upsert({
    where: { fyCode: counterKey },
    create: { fyCode: counterKey, counter: 1 },
    update: { counter: { increment: 1 } },
  });
  const prefix = isInternship ? 'FOI' : 'FO';
  return `${prefix}${fyCode}-${String(counter).padStart(4, '0')}`;
}
