import { NextResponse } from 'next/server';
import { globalRoomManager } from '@/server/RoomManager';

export async function GET() {
  try {
    const rooms = globalRoomManager.getActiveRooms();
    return NextResponse.json({ success: true, rooms });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to fetch active rooms' }, { status: 500 });
  }
}
