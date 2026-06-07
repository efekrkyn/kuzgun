import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const campaignName = body.name || 'Untitled';
    
    // Generate a secure 8-character ID
    const campaignId = crypto.randomBytes(4).toString('hex');
    
    return NextResponse.json({
      success: true,
      campaignId,
      name: campaignName,
      url: `/h/${campaignId}`
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 });
  }
}
