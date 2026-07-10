// One-off: remap old flat expense categories to the new main-category +
// subcategory scheme. Safe to re-run — only touches rows still on an old category.
import { prisma } from './prisma.js';

const MAP = {
  Salary: { category: 'Salary', subCategory: null },
  Rent: { category: 'Rent', subCategory: null },
  Marketing: { category: 'Marketing', subCategory: 'Other Marketing' },
  Electricity: { category: 'Office Expense', subCategory: 'Electricity' },
  Internet: { category: 'Office Expense', subCategory: 'Internet' },
  Software: { category: 'Office Expense', subCategory: 'Software' },
  Office: { category: 'Office Expense', subCategory: null },
  Travel: { category: 'Sales', subCategory: 'TA/DA' },
  Miscellaneous: { category: 'Miscellaneous', subCategory: null },
};

async function main() {
  for (const [oldCategory, { category, subCategory }] of Object.entries(MAP)) {
    const r = await prisma.expense.updateMany({ where: { category: oldCategory, subCategory: null }, data: { category, subCategory } });
    if (r.count) console.log(`${oldCategory} -> ${category}${subCategory ? ' / ' + subCategory : ''}: ${r.count} row(s)`);
  }
  console.log('Done.');
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
