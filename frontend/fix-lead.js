const fs = require('fs');

// Fix LeadsPage - initialize all form fields with empty strings
let c = fs.readFileSync('src/pages/leads/LeadsPage.jsx', 'utf8');
c = c.replace(
  "const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', source: '', interestedCourse: '', status: 'NEW' });",
  "const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', source: '', interestedCourse: '', status: 'NEW', budget: '', expectedJoinDate: '' });"
);
fs.writeFileSync('src/pages/leads/LeadsPage.jsx', c);
console.log('Fixed LeadsPage form');
