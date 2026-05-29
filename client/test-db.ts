import { db } from '../server/src/db/index.js';
import { rooms } from '../server/src/db/schema.js';
console.log('Connecting to DB...');
db.select().from(rooms).limit(1).then(r => {
  console.log('Result:', r);
  process.exit(0);
}).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
