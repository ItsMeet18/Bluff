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

    const session = sessionToken ? await roomStore.getSession(sessionToken) : null;
    const room = await roomStore.getRoom(roomCode, true);

    if (!room) {
      if (session && session.roomCode === roomCode.trim().toUpperCase()) {
        session.roomCode = undefined;
        await roomStore.saveSession(session);
      }
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    if (room.isWaitingRoomExpired()) {
      await roomStore.deleteRoom(roomCode);
      if (session && session.roomCode === room.roomCode) {
        session.roomCode = undefined;
        await roomStore.saveSession(session);
      }
      return NextResponse.json({ success: false, error: 'Room has expired' }, { status: 410 });
    }

    if (session && room.kickedPlayerIds?.includes(session.playerId)) {
      if (session.roomCode === room.roomCode) {
        session.roomCode = undefined;
        await roomStore.saveSession(session);
      }
      return NextResponse.json(
        { success: false, error: 'You were removed from the room by the host', kicked: true },
        { status: 403 }
      );
    }

    // If player was disconnected, mark them reconnected once
    if (session) {
      const player = room.players.find(p => p.id === session.playerId);
      if (player && !player.isConnected) {
        room.reconnectPlayer(session.playerId);
        await roomStore.saveRoom(room);
      }
    }

    // If client already has the latest state version, return lightweight 200 notModified
    if (clientVersion && String(room.version) === String(clientVersion)) {
      return NextResponse.json({ success: true, notModified: true, version: room.version });
    }

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

    const session = sessionToken ? await roomStore.getSession(sessionToken) : null;
    const room = await roomStore.getRoom(roomCode, true);

    if (!room) {
      if (session && session.roomCode === roomCode.trim().toUpperCase()) {
        session.roomCode = undefined;
        await roomStore.saveSession(session);
      }
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    if (room.isWaitingRoomExpired()) {
      await roomStore.deleteRoom(roomCode);
      if (session && session.roomCode === room.roomCode) {
        session.roomCode = undefined;
        await roomStore.saveSession(session);
      }
      return NextResponse.json({ success: false, error: 'Room has expired' }, { status: 410 });
    }

    if (session && room.kickedPlayerIds?.includes(session.playerId)) {
      if (session.roomCode === room.roomCode) {
        session.roomCode = undefined;
        await roomStore.saveSession(session);
      }
      return NextResponse.json(
        { success: false, error: 'You were removed from the room by the host', kicked: true },
        { status: 403 }
      );
    }

    if (session) {
      const player = room.players.find(p => p.id === session.playerId);
      if (player && !player.isConnected) {
        room.reconnectPlayer(session.playerId);
        await roomStore.saveRoom(room);
      }
    }

    if (clientVersion && String(room.version) === String(clientVersion)) {
      return NextResponse.json({ success: true, notModified: true, version: room.version });
    }

    const state = room.getPublicState(session?.playerId);

    return NextResponse.json({ success: true, state, version: room.version });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to sync room state' }, { status: 500 });
  }
}
