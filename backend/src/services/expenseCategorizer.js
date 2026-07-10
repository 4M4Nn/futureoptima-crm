import { prisma } from '../utils/prisma.js';

// Checked in order — first match wins. Kept ahead of the AI fallback so obvious
// cases don't cost an API call.
const CATEGORY_RULES = [
  { category: 'Salary', subCategory: null, keywords: ['salary', 'wages', 'payroll'] },
  { category: 'Rent', subCategory: null, keywords: ['rent', 'lease'] },
  { category: 'Marketing', subCategory: 'Meta Ads', keywords: ['meta ads', 'facebook ads', 'instagram ads', 'fb ads'] },
  { category: 'Marketing', subCategory: 'Google Ads', keywords: ['google ads', 'adwords'] },
  { category: 'Marketing', subCategory: 'Other Marketing', keywords: ['marketing', 'promotion', 'advertisement'] },
  { category: 'Sales', subCategory: 'B2B & Sales Expense', keywords: ['b2b', 'sales expense', 'client visit'] },
  { category: 'Sales', subCategory: 'Incentive', keywords: ['incentive', 'commission'] },
  { category: 'Sales', subCategory: 'TA/DA', keywords: ['ta/da', 'ta da', 'travel allowance', 'conveyance', 'travel'] },
  { category: 'Office Expense', subCategory: 'Electricity', keywords: ['electricity', 'kseb', 'power bill'] },
  { category: 'Office Expense', subCategory: 'Internet', keywords: ['internet', 'wifi', 'broadband'] },
  { category: 'Office Expense', subCategory: 'Software', keywords: ['software', 'subscription', 'saas', 'license', 'zoom', 'canva', 'adobe'] },
  { category: 'Office Expense', subCategory: 'Stationary', keywords: ['stationary', 'stationery'] },
  { category: 'Office Expense', subCategory: 'Tea & Snacks', keywords: ['tea', 'snack', 'coffee', 'refreshment'] },
  { category: 'Office Expense', subCategory: 'Team Outing', keywords: ['outing', 'team event'] },
  { category: 'Office Expense', subCategory: 'Administrative Cost', keywords: ['admin', 'administrative', 'courier', 'printing', 'postage'] },
];

export function ruleBasedCategorize(text) {
  const lower = (text || '').toLowerCase();
  if (!lower) return null;
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) {
      return { category: rule.category, subCategory: rule.subCategory, source: 'rule' };
    }
  }
  return null;
}

// Loose name match against the active employee roster (full name, or any
// name-part longer than 2 chars) so "Salary - Rahul June" or "Paid Rahul Menon"
// both match employee "Rahul Menon".
export async function matchEmployee(text) {
  const lower = (text || '').toLowerCase();
  if (!lower) return null;
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, name: true, designation: true, department: true, basicSalary: true, bankAccount: true, userId: true, isExternalEmployee: true },
  });
  return employees.find(e => {
    const nameLower = e.name.toLowerCase();
    if (lower.includes(nameLower)) return true;
    return nameLower.split(/\s+/).some(part => part.length > 2 && lower.includes(part));
  }) || null;
}

const CATEGORY_GUIDE = 'Salary, Rent, Marketing (Meta Ads / Google Ads / Other Marketing), '
  + 'Sales (B2B & Sales Expense / Incentive / TA/DA), '
  + 'Office Expense (Administrative Cost / Stationary / Tea & Snacks / Team Outing / Electricity / Internet / Software), '
  + 'Miscellaneous';

// Classifies a batch of ambiguous rows in a single Groq call (cheaper and faster
// than one call per row). Returns null (caller should fall back to Miscellaneous)
// if no API key is configured or the model output can't be parsed.
export async function aiCategorizeBatch(descriptions) {
  if (!process.env.GROQ_API_KEY || descriptions.length === 0) return descriptions.map(() => null);

  const prompt = `Categorize each expense description below for an IT training institute into one of these categories/sub-categories:
${CATEGORY_GUIDE}

Return ONLY a JSON array, one object per line in the same order, no markdown or explanation:
[{"category": "...", "subCategory": "..." or null}, ...]

Descriptions:
${descriptions.map((d, i) => `${i + 1}. ${d || 'Unknown'}`).join('\n')}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const content = data.choices[0].message.content.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return descriptions.map(() => null);
    const parsed = JSON.parse(jsonMatch[0]);
    return descriptions.map((_, i) => parsed[i]
      ? { category: parsed[i].category || 'Miscellaneous', subCategory: parsed[i].subCategory || null, source: 'ai' }
      : null);
  } catch {
    return descriptions.map(() => null);
  }
}
