import { NextRequest, NextResponse } from 'next/server';
import { roomStore } from '@/server/RedisRoomStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { sessionToken, playerName } = body;
    const session = await roomStore.getOrCreateSession(sessionToken, playerName);

    return NextResponse.json({
      success: true,
      sessionToken: session.token,
      playerId: session.playerId,
      playerName: session.playerName,
      roomCode: session.roomCode,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to authenticate session' },
      { status: 500 }
    );
  }
}
