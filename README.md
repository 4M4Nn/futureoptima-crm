# Nexora CRM
### AI-Powered Institute CRM for Future Optima IT Solutions
**Built by Nexora AI Solutions**

---

## 🚀 Quick Start (Windows PowerShell)

### Step 1 — Install dependencies
```powershell
cd nexora-crm
npm run install:all
```

### Step 2 — Configure environment
```powershell
cd backend
Copy-Item .env.example .env
notepad .env
```
Fill in these required values:
- `DATABASE_URL` — Your Neon PostgreSQL URL
- `TWILIO_ACCOUNT_SID` — From Twilio console
- `TWILIO_AUTH_TOKEN` — From Twilio console
- `TWILIO_WHATSAPP_FROM` — e.g. `whatsapp:+14155238886`

### Step 3 — Setup database
```powershell
cd backend
npx prisma db push
node src/utils/seed.js
```

### Step 4 — Start Ollama (AI Engine)
```powershell
# In a separate terminal:
ollama pull llama3.2
ollama serve
```

### Step 5 — Start the app
```powershell
# From root (nexora-crm folder):
npm run dev
```

- **Frontend** → http://localhost:7173
- **Backend API** → http://localhost:7000
- **DB Studio** → `npm run db:studio`

---

## 🔑 Default Login
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@nexora.ai | Admin@123 |
| Counselor | counselor@futureoptima.in | Counselor@123 |

---

## 🌐 Production Deployment

### Backend → Render.com
1. Push code to GitHub
2. New Web Service → Connect repo
3. Root directory: `backend`
4. Build: `npm install && npx prisma generate && npx prisma db push`
5. Start: `node src/index.js`
6. Add all env vars from `.env.example`

### Frontend → Vercel
1. New Project → Import from GitHub
2. Root directory: `frontend`
3. Framework: Vite
4. Add env var: `VITE_API_URL=https://your-render-backend.onrender.com`

### For Ollama in production:
- Deploy Ollama on a VPS (DigitalOcean/AWS EC2)
- Or use Groq/Together API as Ollama replacement (update ollamaService.js)

---

## 🗂️ System Architecture

```
nexora-crm/
├── backend/
│   ├── prisma/schema.prisma     # Full DB schema
│   ├── src/
│   │   ├── index.js             # Express server
│   │   ├── routes/              # All API routes
│   │   ├── services/
│   │   │   ├── ollamaService.js  # AI lead scoring + chat
│   │   │   ├── whatsappService.js # Twilio WhatsApp
│   │   │   ├── receiptService.js  # PDF generation
│   │   │   └── reminderService.js # Cron reminders
│   │   ├── middleware/auth.js    # JWT auth
│   │   └── utils/               # Helpers
└── frontend/
    └── src/
        ├── pages/               # All 14 pages
        ├── components/          # Reusable UI
        ├── store/authStore.js   # Zustand state
        └── utils/               # API client + constants
```

---

## 🤖 AI Features (Ollama)

| Feature | Description |
|---------|-------------|
| **Lead Scoring** | Scores every lead HOT/WARM/COLD/UNQUALIFIED (0-100) |
| **Auto-scoring** | Fires on new lead creation, nightly batch at 2AM |
| **AI Chat** | CRM assistant — ask anything about leads, strategies |
| **Reply Suggester** | AI-generated WhatsApp follow-up messages per lead |
| **Campaign Generator** | AI writes bulk WhatsApp campaign messages |
| **Task Suggestions** | AI suggests daily counselor tasks |
| **Reminder Drafts** | AI drafts payment reminder messages |

---

## 💳 WhatsApp + Payments

- Payment recorded → WhatsApp receipt **auto-sent** within seconds
- PDF receipt generated with QR code, amount in words, installment summary
- Installment reminders cron at **9AM daily**
- Overdue installments auto-flagged
- Campaign bulk-send with delivery tracking

---

## 📊 Courses Managed

| Course | Duration | Fee |
|--------|----------|-----|
| AI Engineering & Automation | 6 months | ₹75,000 |
| Data Science with AI | 5 months | ₹60,000 |
| AI-Powered Cybersecurity | 4 months | ₹65,000 |
| Python Full Stack with AI | 5 months | ₹55,000 |
| Vibe Coding & SaaS Dev | 4 months | ₹58,000 |
| Data Analytics | 3 months | ₹35,000 |
| Business Analytics | 3 months | ₹38,000 |

---

## 🛠 Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + Framer Motion + Recharts
- **Backend**: Node.js + Express (ESM) + Prisma ORM
- **Database**: PostgreSQL (Neon) — indexed for 1 lakh+ records
- **AI**: Ollama (llama3.2) — local, zero API cost
- **WhatsApp**: Twilio WhatsApp Business API
- **PDF**: PDFKit + QRCode
- **Auth**: JWT + bcrypt
- **Deploy**: Render (backend) + Vercel (frontend)

---

*Nexora AI Solutions • Kerala, India*
