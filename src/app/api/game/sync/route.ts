import { NextRequest, NextResponse } from 'next/server';
import { roomStore } from '@/server/RedisRoomStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { roomCode, sessionToken } = body;

    if (!roomCode) {
      return NextResponse.json({ success: false, error: 'Room code is required' }, { status: 400 });
    }

    const session = sessionToken ? await roomStore.getSession(sessionToken) : null;
    const room = await roomStore.getRoom(roomCode);

    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    const state = room.getPublicState(session?.playerId);
    return NextResponse.json({ success: true, state });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to sync room state' }, { status: 500 });
  }
}
