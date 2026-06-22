import fs from 'fs';
let env = fs.readFileSync('.env', 'utf8');
env = env.replace(/INSTITUTE_WEBSITE=.*/g, 'INSTITUTE_WEBSITE=https://www.futureoptimaitsolutions.com');
fs.writeFileSync('.env', env);
console.log('Website URL updated!');
