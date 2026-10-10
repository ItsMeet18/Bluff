import { NextRequest, NextResponse } from 'next/server';
import { roomStore } from '@/server/RedisRoomStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { roomCode, playerName, sessionToken } = body;

    if (!roomCode) {
      return NextResponse.json({ success: false, error: 'Room code is required' }, { status: 400 });
    }

    const session = await roomStore.getOrCreateSession(sessionToken, playerName);
    const result = await roomStore.joinRoom(
      {
        roomCode,
        playerName: session.playerName,
      },
      session
    );

    if (!result.success || !result.room) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to join room' }, { status: 400 });
    }

    const state = result.room.getPublicState(session.playerId);
    return NextResponse.json({
      success: true,
      roomCode: result.room.roomCode,
      state,
      sessionToken: session.token,
      playerId: session.playerId,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to join room' }, { status: 500 });
  }
}
