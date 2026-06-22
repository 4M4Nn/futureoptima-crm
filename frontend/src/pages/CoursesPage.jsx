import { useQuery } from '@tanstack/react-query';
import { BookOpen, Users, Clock, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../utils/api';
import { fmt } from '../utils/constants';
import { LoadingState } from '../components/ui/index';

const COURSE_ICONS = { AI_ENGINEERING: '🤖', DATA_SCIENCE_AI: '📊', AI_CYBERSECURITY: '🔐', PYTHON_FULLSTACK: '🐍', VIBE_CODING_SAAS: '🚀', DATA_ANALYTICS: '📈', BUSINESS_ANALYTICS: '💼' };
const COURSE_COLORS = ['from-indigo-500 to-purple-600', 'from-blue-500 to-cyan-600', 'from-red-500 to-orange-600', 'from-green-500 to-teal-600', 'from-pink-500 to-rose-600', 'from-yellow-500 to-amber-600', 'from-slate-500 to-gray-600'];

export default function CoursesPage() {
  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses-full'],
    queryFn: () => api.get('/courses').then(r => r.data),
  });

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title">Courses</h1>
        <p className="text-gray-500 text-sm">{courses?.length || 0} active courses at Future Optima IT Solutions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {(courses || []).map((course, i) => (
          <motion.div key={course.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="card overflow-hidden">
            {/* Card header gradient */}
            <div className={`bg-gradient-to-br ${COURSE_COLORS[i % COURSE_COLORS.length]} p-5`}>
              <div className="text-4xl mb-2">{COURSE_ICONS[course.courseId] || '📚'}</div>
              <h3 className="font-bold text-white text-base leading-tight">{course.name}</h3>
              <div className="text-white/80 text-sm mt-1">{course.shortName}</div>
            </div>
            {/* Details */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>{course.duration}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BookOpen className="w-4 h-4 text-gray-400" />
                  <span>{course.totalHours}h</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <span className="text-green-600">{fmt(course.fees)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span>{course._count?.enrollments || 0} enrolled</span>
                </div>
              </div>

              {course.highlights?.length > 0 && (
                <div className="space-y-1">
                  {course.highlights.map((h, j) => (
                    <div key={j} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="text-green-500">✓</span>{h}
                    </div>
                  ))}
                </div>
              )}

              {course.emiAvailable && (
                <div className="bg-blue-50 rounded-lg px-3 py-1.5 text-xs text-blue-700 font-medium">
                  💳 EMI available — up to {course.maxInstallments} installments
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
