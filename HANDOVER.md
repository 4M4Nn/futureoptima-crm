# Future Optima CRM - Handover Document
**Built by Nexora AI Solutions**
**Delivery Date: June 2026**

---

## Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@futureoptima.in | FutureOptima@2025 |
| Counselor | counselor@futureoptima.in | Counselor@123 |

> Run `node src/utils/seed.js` from the backend directory to create these accounts.

---

## What This System Does (Simple Language)

- **Manages all student leads** from Facebook, Instagram, walk-ins, referrals
- **AI automatically scores each lead** as Hot/Warm/Cold using Ollama (local AI, zero API cost)
- **Enroll students** with course fee, discount, and installment plan in one click
- **Record payments** and **download PDF receipt** instantly from the browser
- **Track all installments** and see who has overdue payments
- **Bulk WhatsApp campaigns** to leads (queue messages for manual sending)
- **View analytics and reports** — Fee collection, Course enrollment, Lead sources, Counselor performance
- **Meta Ads integration** — Facebook and Instagram leads auto-imported via webhook
- **Manage your team** with roles (Admin, Counselor, Accountant, Viewer)

---

## How To Use — Step by Step

### 1. Adding a Lead
Click **Leads** → **Add Lead** → fill name, phone, course → **Save**
The AI will automatically score the lead as Hot/Warm/Cold within seconds.

### 2. Enrolling a Student
Open a lead → click **Enroll** → select course → set fee → set discount (if any) → set number of installments → **Confirm Enrollment**
The student will appear in the **Students** section.

### 3. Recording a Payment
Click **Payments** → **Record Payment** → search phone number → select installment → enter amount → **Record Payment** → **Download Receipt PDF**

### 4. Viewing Reports
Click **Reports** → select tab:
- **Fee Collection**: Pick a month, see daily chart + table, export CSV
- **Course Enrollment**: See enrollment counts by course
- **Lead Sources**: See which channels bring the most leads
- **Counselor Performance**: (Admin only) See who's converting the most leads

### 5. Adding a Team Member
Click **Users** → **Add User** → fill details → set role → **Create User**

### 6. Connecting Facebook/Instagram Ads
Click **Meta Ads** → copy the Webhook URL → follow the setup guide on the page

### 7. AI Lead Scoring
Happens automatically when a lead is added. Click **Score All** on the Leads page to manually re-score all leads.

---

## Credentials You Need to Set Up

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Where to Get |
|----------|-------------|
| `DATABASE_URL` | Neon dashboard → Connection string |
| `JWT_SECRET` | Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `OLLAMA_BASE_URL` | Install from ollama.ai, run `ollama serve` |
| `META_VERIFY_TOKEN` | Already set: `futureoptima_meta_2025` |
| `META_APP_SECRET` | Facebook Developer Console |

### Install Ollama (AI Engine)
```bash
# Windows: Download from https://ollama.ai/download
ollama pull llama3.2
ollama serve
```

---

## Monthly Maintenance

- **Nexora AI Solutions handles** all technical issues, updates, and bug fixes
- **Support Email**: support@nexoraai.in
- **Response Time**: Within 24 hours on business days
- **Maintenance Fee**: ₹5,000/month (includes hosting support, bug fixes, minor updates)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express + Prisma ORM |
| Database | PostgreSQL (Neon serverless) |
| AI Engine | Ollama (llama3.2, runs locally) |
| PDF Receipts | PDFKit + QR Code |
| Deployment | Render (backend) + Vercel (frontend) |

---

*Built with ❤️ by Nexora AI Solutions*
*© 2026 Nexora AI Solutions. All rights reserved.*
