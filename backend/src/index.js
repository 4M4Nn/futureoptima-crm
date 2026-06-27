import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import cron from 'node-cron';
import { logger } from './utils/logger.js';
import { prisma } from './utils/prisma.js';

dotenv.config();

import authRoutes from './routes/auth.js';
import leadRoutes from './routes/leads.js';
import courseRoutes from './routes/courses.js';
import enrollmentRoutes from './routes/enrollments.js';
import paymentRoutes from './routes/payments.js';
import whatsappRoutes from './routes/whatsapp.js';
import taskRoutes from './routes/tasks.js';
import analyticsRoutes from './routes/analytics.js';
import aiRoutes from './routes/ai.js';
import userRoutes from './routes/users.js';
import campaignRoutes from './routes/campaigns.js';
import settingsRoutes from './routes/settings.js';
import metaRoutes from './routes/meta.js';
import financeRoutes from './routes/finance.js';
import certificateRoutes from './routes/certificates.js';
import aiCommandRoutes from './routes/aicommand.js';
import forecastRoutes from './routes/forecast.js';
import { sendInstallmentReminders } from './services/reminderService.js';

const app = express();
const PORT = process.env.PORT || 7000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:7173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));
app.use(morgan('combined', { stream: { write: m => logger.info(m.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'healthy', service: 'Nexora CRM API', version: '1.0.0', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/aicommand', aiCommandRoutes);
app.use('/api/forecast', forecastRoutes);

app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl}`);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message });
});

app.use('*', (req, res) => res.status(404).json({ error: 'Route not found' }));

if (process.env.ENABLE_CRONS === 'true') {
  cron.schedule(process.env.REMINDER_CRON || '0 9 * * *', async () => {
    logger.info('Running installment reminder cron...');
    await sendInstallmentReminders();
  });
  // Re-score leads every night at 2AM
  cron.schedule('0 2 * * *', async () => {
    const { batchScoreLeads } = await import('./services/ollamaService.js');
    await batchScoreLeads(100);
  });
}

const server = app.listen(PORT, () => {
  logger.info(`🚀 Nexora CRM API → http://localhost:${PORT}`);
  logger.info(`🤖 Groq AI → ${process.env.GROQ_MODEL || 'llama-3.1-8b-instant'}`);
});

process.on('SIGTERM', async () => {
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
});

export default app;
