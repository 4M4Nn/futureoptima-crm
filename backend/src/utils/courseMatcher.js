import { prisma } from './prisma.js';

// Loose match of free-text course names from an import sheet ("Internship",
// "Vacation Class", "Data Science with AI"...) against real Course records:
// exact CourseId enum, exact name/shortName, then substring either direction.
export async function matchCourse(text) {
  if (!text) return null;
  const raw = String(text).trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const courses = await prisma.course.findMany({ where: { isActive: true } });

  const byId = courses.find(c => c.courseId.toLowerCase() === lower.replace(/\s+/g, '_'));
  if (byId) return byId;

  const exact = courses.find(c => c.name.toLowerCase() === lower || c.shortName.toLowerCase() === lower);
  if (exact) return exact;

  return courses.find(c =>
    lower.includes(c.name.toLowerCase()) || lower.includes(c.shortName.toLowerCase())
    || c.name.toLowerCase().includes(lower) || c.shortName.toLowerCase().includes(lower)
  ) || null;
}
