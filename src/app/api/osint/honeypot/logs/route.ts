import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM honeypot_logs 
      ORDER BY captured_at DESC 
      LIMIT 100
    `);
    const logs = stmt.all();
    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
