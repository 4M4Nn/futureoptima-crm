import fs from 'fs';
let env = fs.readFileSync('.env', 'utf8');
env = env.replace(/GROQ_API_KEY=.*/g, 'GROQ_API_KEY=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');
fs.writeFileSync('.env', env);
console.log('GROQ API key updated in .env!');
