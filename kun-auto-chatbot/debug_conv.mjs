import { getDb } from './server/db.ts';
import { conversations, messages } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const db = getDb();
const conv = await db.select().from(conversations).where(eq(conversations.id, 30005));
console.log('Conversation:', JSON.stringify(conv, null, 2));

const msgs = await db.select().from(messages).where(eq(messages.conversationId, 30005));
console.log('\nTotal messages:', msgs.length);
console.log('User messages:', msgs.filter(m => m.role === 'user').length);
console.log('Assistant messages:', msgs.filter(m => m.role === 'assistant').length);

for (const m of msgs) {
  console.log(`\n[${m.id}] ${m.role} (${m.createdAt}):`);
  console.log(m.content.substring(0, 200));
}
process.exit(0);
