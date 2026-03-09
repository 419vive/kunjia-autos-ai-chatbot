import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.query(
  "SELECT id, customerName, sessionId, channel, leadScore FROM conversations WHERE channel = 'line' ORDER BY id DESC LIMIT 10"
);
console.log('LINE conversations:');
for (const r of rows) {
  console.log(`ID: ${r.id} | Name: ${r.customerName} | SessionID: ${r.sessionId} | Score: ${r.leadScore}`);
}
await conn.end();
