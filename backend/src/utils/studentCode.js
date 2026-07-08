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

const CODE_PATTERN = /^FO(I)?(\d{4})-(\d{4})$/;

// Must be called inside a prisma $transaction (tx). If the deleted student held the
// most-recently-issued number in its FY/type bucket, rolls the counter back by one so
// the next enrollment reuses it instead of leaving a gap. Uses a single conditional
// UPDATE (only decrements if the counter still equals this code's sequence number) so
// it's safe even if another enrollment was created in the same instant — deleting a
// student in the middle of a sequence intentionally leaves that gap rather than
// renumbering everyone after it, which would change other students' issued codes.
export async function releaseStudentCode(tx, studentCode) {
  if (!studentCode) return;
  const match = studentCode.match(CODE_PATTERN);
  if (!match) return;
  const [, isInternshipFlag, fyCode, seqStr] = match;
  const counterKey = isInternshipFlag ? `${fyCode}-INT` : fyCode;
  const seq = parseInt(seqStr, 10);
  await tx.financialYearCounter.updateMany({
    where: { fyCode: counterKey, counter: seq },
    data: { counter: { decrement: 1 } },
  });
}
