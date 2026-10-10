import { NextRequest, NextResponse } from 'next/server';
import { roomStore } from '@/server/RedisRoomStore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomCode = searchParams.get('roomCode') || searchParams.get('room');
    const sessionToken = searchParams.get('sessionToken') || searchParams.get('token');
    const clientVersion = searchParams.get('v') || searchParams.get('version');

    if (!roomCode) {
      return NextResponse.json({ success: false, error: 'Room code is required' }, { status: 400 });
    }

    const room = await roomStore.getRoom(roomCode);
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    // If client already has the latest state version, return lightweight 200 notModified
    // without redundant session lookups or state re-serialization!
    if (clientVersion && String(room.version) === String(clientVersion)) {
      return NextResponse.json({ success: true, notModified: true, version: room.version });
    }

    // Resolves via in-process session cache (0 Redis commands on warm lambda)
    const session = sessionToken ? await roomStore.getSession(sessionToken) : null;
    const state = room.getPublicState(session?.playerId);

    return NextResponse.json({ success: true, state, version: room.version });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to sync room state' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { roomCode, sessionToken, v, version } = body;
    const clientVersion = v !== undefined ? v : version;

    if (!roomCode) {
      return NextResponse.json({ success: false, error: 'Room code is required' }, { status: 400 });
    }

    const room = await roomStore.getRoom(roomCode);
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    if (clientVersion && String(room.version) === String(clientVersion)) {
      return NextResponse.json({ success: true, notModified: true, version: room.version });
    }

    const session = sessionToken ? await roomStore.getSession(sessionToken) : null;
    const state = room.getPublicState(session?.playerId);

    return NextResponse.json({ success: true, state, version: room.version });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to sync room state' }, { status: 500 });
  }
}
