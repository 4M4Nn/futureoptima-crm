import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certsDir = path.join(__dirname, '../../uploads/certificates');
if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir, { recursive: true });

const router = express.Router();
router.use(authenticate);

function generateCertNo() {
  const year = new Date().getFullYear();
  const seq = Math.floor(1000 + Math.random() * 9000);
  return `FOITC-${year}-${seq}`;
}

async function generateCertificatePDF(data) {
  const { studentName, courseName, duration, type, certificateNo, completionDate, issuedAt } = data;
  const filename = `cert_${certificateNo.replace(/[^a-z0-9]/gi, '_')}.pdf`;
  const filePath = path.join(certsDir, filename);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W = doc.page.width;
    const H = doc.page.height;

    // Background
    doc.rect(0, 0, W, H).fill('#FAFAFA');

    // Outer border
    doc.rect(20, 20, W - 40, H - 40).strokeColor('#1B2B6B').lineWidth(3).stroke();
    doc.rect(26, 26, W - 52, H - 52).strokeColor('#F59E0B').lineWidth(1.5).stroke();

    // Header band
    doc.rect(20, 20, W - 40, 80).fill('#1B2B6B');

    // Institute name
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
      .text(process.env.INSTITUTE_NAME || 'Future Optima IT Solutions', 40, 35, { align: 'center', width: W - 80 });
    doc.fillColor('#93C5FD').fontSize(9).font('Helvetica')
      .text((process.env.INSTITUTE_ADDRESS || 'Kakkanad, Kochi, Kerala') + '  |  ' + (process.env.INSTITUTE_WEBSITE || 'www.futureoptima.in'), 40, 62, { align: 'center', width: W - 80 });

    // Certificate title
    const title = type === 'INTERNSHIP' ? 'INTERNSHIP CERTIFICATE' : 'CERTIFICATE OF COMPLETION';
    doc.fillColor('#1B2B6B').fontSize(28).font('Helvetica-Bold')
      .text(title, 40, 118, { align: 'center', width: W - 80 });

    // Gold underline
    const titleW = 340;
    doc.moveTo((W - titleW) / 2, 156).lineTo((W + titleW) / 2, 156).strokeColor('#F59E0B').lineWidth(2).stroke();

    // Body text
    const bodyY = 172;
    doc.fillColor('#4B5563').fontSize(12).font('Helvetica')
      .text('This is to certify that', 40, bodyY, { align: 'center', width: W - 80 });

    // Student name
    doc.fillColor('#1B2B6B').fontSize(26).font('Helvetica-Bold')
      .text(studentName, 40, bodyY + 22, { align: 'center', width: W - 80 });

    // Underline for name
    const nameW = Math.min(studentName.length * 14, 400);
    doc.moveTo((W - nameW) / 2, bodyY + 54).lineTo((W + nameW) / 2, bodyY + 54).strokeColor('#CBD5E1').lineWidth(1).stroke();

    if (type === 'INTERNSHIP') {
      doc.fillColor('#4B5563').fontSize(11).font('Helvetica')
        .text('has successfully completed an internship program in', 40, bodyY + 62, { align: 'center', width: W - 80 });
    } else {
      doc.fillColor('#4B5563').fontSize(11).font('Helvetica')
        .text('has successfully completed the course', 40, bodyY + 62, { align: 'center', width: W - 80 });
    }

    // Course name
    doc.fillColor('#1B2B6B').fontSize(16).font('Helvetica-Bold')
      .text(courseName, 40, bodyY + 80, { align: 'center', width: W - 80 });

    // Duration and date
    const detailY = bodyY + 112;
    doc.fillColor('#4B5563').fontSize(10).font('Helvetica')
      .text(`Duration: ${duration}`, 40, detailY, { align: 'center', width: W - 80 });

    const dateLabel = type === 'INTERNSHIP' ? 'Internship Completed On' : 'Completed On';
    doc.text(`${dateLabel}: ${completionDate}`, 40, detailY + 16, { align: 'center', width: W - 80 });

    // Certificate number
    doc.fillColor('#6B7280').fontSize(8).font('Helvetica')
      .text(`Certificate No: ${certificateNo}`, 40, detailY + 36, { align: 'center', width: W - 80 });
    doc.text(`Issued On: ${issuedAt}`, 40, detailY + 48, { align: 'center', width: W - 80 });

    // Signature lines
    const sigY = H - 100;
    const sig1X = 100, sig2X = W - 230;
    doc.moveTo(sig1X, sigY).lineTo(sig1X + 160, sigY).strokeColor('#374151').lineWidth(1).stroke();
    doc.moveTo(sig2X, sigY).lineTo(sig2X + 160, sigY).strokeColor('#374151').lineWidth(1).stroke();

    doc.fillColor('#374151').fontSize(9).font('Helvetica-Bold')
      .text('Director', sig1X, sigY + 6, { width: 160, align: 'center' })
      .text(process.env.INSTITUTE_NAME || 'Future Optima IT Solutions', sig1X, sigY + 18, { width: 160, align: 'center', fontSize: 7 });

    doc.fontSize(9).font('Helvetica-Bold')
      .text('Authorized Signatory', sig2X, sigY + 6, { width: 160, align: 'center' })
      .text(process.env.INSTITUTE_NAME || 'Future Optima IT Solutions', sig2X, sigY + 18, { width: 160, align: 'center', fontSize: 7 });

    // Footer
    doc.rect(20, H - 42, W - 40, 22).fill('#1B2B6B');
    doc.fillColor('white').fontSize(8).font('Helvetica')
      .text(`${process.env.INSTITUTE_PHONE || '+91-8891129333'}  |  ${process.env.INSTITUTE_EMAIL || 'info@futureoptimaitsolutions.com'}  |  ${process.env.INSTITUTE_WEBSITE || 'www.futureoptima.in'}`, 40, H - 35, { align: 'center', width: W - 80 });

    doc.end();
    stream.on('finish', () => resolve({ filePath, filename }));
    stream.on('error', reject);
  });
}

async function buildCertData(enrollment) {
  const lead = enrollment.lead;
  const course = enrollment.course;
  const completionDate = enrollment.completedAt
    ? new Date(enrollment.completedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  return {
    studentName: lead.name,
    courseName: course.name,
    duration: course.duration,
    completionDate,
    issuedAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
  };
}

// POST /api/certificates/generate
router.post('/generate', [
  body('enrollmentId').notEmpty(),
  body('type').isIn(['COMPLETION', 'INTERNSHIP']),
], authorize('SUPER_ADMIN', 'ADMIN', 'FACULTY'), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { enrollmentId, type } = req.body;

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { lead: true, course: true },
    });
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

    const certNo = generateCertNo();
    const certData = await buildCertData(enrollment);
    const { filePath, filename } = await generateCertificatePDF({ ...certData, type, certificateNo: certNo });

    const certificate = await prisma.certificate.create({
      data: {
        enrollmentId,
        type,
        certificateNo: certNo,
        generatedById: req.user.id,
        templateUsed: type === 'INTERNSHIP' ? 'internship-v1' : 'completion-v1',
      },
      include: {
        enrollment: { include: { lead: { select: { name: true } }, course: { select: { name: true } } } },
        generatedBy: { select: { name: true } },
      },
    });

    res.status(201).json({
      ...certificate,
      downloadUrl: `/uploads/certificates/${filename}`,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/certificates
router.get('/', authorize('SUPER_ADMIN', 'ADMIN', 'FACULTY', 'ACCOUNTANT', 'COUNSELOR'), async (req, res) => {
  try {
    const { type, enrollmentId } = req.query;
    const where = {};
    if (type) where.type = type;
    if (enrollmentId) where.enrollmentId = enrollmentId;

    const certs = await prisma.certificate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        enrollment: {
          include: {
            lead: { select: { name: true, phone: true } },
            course: { select: { shortName: true, name: true } },
          },
        },
        generatedBy: { select: { name: true } },
      },
    });
    res.json(certs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/certificates/:id/download
router.get('/:id/download', async (req, res) => {
  try {
    const cert = await prisma.certificate.findUnique({
      where: { id: req.params.id },
      include: {
        enrollment: { include: { lead: true, course: true } },
      },
    });
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });

    const filename = `cert_${cert.certificateNo.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    const filePath = path.join(certsDir, filename);

    if (!fs.existsSync(filePath)) {
      const certData = await buildCertData(cert.enrollment);
      await generateCertificatePDF({ ...certData, type: cert.type, certificateNo: cert.certificateNo });
    }

    await prisma.certificate.update({ where: { id: cert.id }, data: { downloadCount: { increment: 1 } } });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cert.certificateNo}.pdf"`);
    res.sendFile(path.resolve(filePath));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/certificates/bulk
router.post('/bulk', [
  body('enrollmentIds').isArray({ min: 1 }),
  body('type').isIn(['COMPLETION', 'INTERNSHIP']),
], authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { enrollmentIds, type } = req.body;

    const enrollments = await prisma.enrollment.findMany({
      where: { id: { in: enrollmentIds } },
      include: { lead: true, course: true },
    });

    const generatedFiles = [];

    for (const enrollment of enrollments) {
      const certNo = generateCertNo();
      const certData = await buildCertData(enrollment);
      const { filePath, filename } = await generateCertificatePDF({ ...certData, type, certificateNo: certNo });

      await prisma.certificate.create({
        data: {
          enrollmentId: enrollment.id,
          type,
          certificateNo: certNo,
          generatedById: req.user.id,
          templateUsed: type === 'INTERNSHIP' ? 'internship-v1' : 'completion-v1',
        },
      });

      generatedFiles.push({ filePath, filename, studentName: enrollment.lead.name });
    }

    // Stream ZIP response
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="certificates-bulk-${Date.now()}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', err => { throw err; });
    archive.pipe(res);

    for (const { filePath, filename } of generatedFiles) {
      archive.file(filePath, { name: filename });
    }

    await archive.finalize();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
