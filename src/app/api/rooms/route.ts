import { NextResponse } from 'next/server';
import { roomStore } from '@/server/RedisRoomStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rooms = await roomStore.getActiveRooms();
    return NextResponse.json({ success: true, rooms });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch active rooms' },
      { status: 500 }
    );
  }
}
