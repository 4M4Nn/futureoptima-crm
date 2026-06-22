const fs = require('fs');
let c = fs.readFileSync('src/routes/leads.js', 'utf8');
c = c.replace(
  "body('phone').matches(/^[6-9]\\d{9}$/),",
  "body('phone').notEmpty().trim(),"
);
fs.writeFileSync('src/routes/leads.js', c);
console.log('Fixed phone validation');
