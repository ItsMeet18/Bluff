import { NextRequest, NextResponse } from 'next/server';
import { roomStore } from '@/server/RedisRoomStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { roomCode, sessionToken, action, payload } = body;

    if (!roomCode || !action) {
      return NextResponse.json({ success: false, error: 'Room code and action are required' }, { status: 400 });
    }

    const session = sessionToken ? await roomStore.getSession(sessionToken) : null;
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthenticated or invalid session' }, { status: 401 });
    }

    const playerId = session.playerId;
    const actionName = (typeof action === 'string' ? action : action?.type || '').toLowerCase();
    const actionPayload = payload || (typeof action === 'object' ? action : {});

    const actionResult = await roomStore.runAtomic(roomCode, room => {
      const player = room.players.find(p => p.id === playerId);
      if (!player && actionName !== 'leave_room') {
        return { result: { success: false, error: 'Player not in this room' }, changed: false };
      }

      switch (actionName) {
        case 'start_game': {
          const res = room.startGame(playerId);
          return { result: res, changed: res.success };
        }

        case 'play_cards': {
          if (player?.isSpectator) {
            return { result: { success: false, error: 'Spectators cannot play cards' }, changed: false };
          }
          const { cardIds, declaredRank } = actionPayload;
          const res = room.playCards(playerId, cardIds || [], declaredRank);
          return { result: res, changed: res.success };
        }

        case 'pass_turn': {
          if (player?.isSpectator) {
            return { result: { success: false, error: 'Spectators cannot pass turn' }, changed: false };
          }
          const res = room.passTurn(playerId);
          return { result: res, changed: res.success };
        }

        case 'call_bluff': {
          if (player?.isSpectator) {
            return { result: { success: false, error: 'Spectators cannot challenge' }, changed: false };
          }
          const { selectedCardId } = actionPayload;
          const res = room.challengeBluff(playerId, selectedCardId);
          return { result: res, changed: res.success };
        }

        case 'play_again': {
          if (room.status === 'waiting') {
            return { result: { success: true }, changed: false };
          }
          const res = room.resetForRematch(playerId);
          return { result: res, changed: res.success };
        }

        case 'leave_room': {
          const { roomEmpty } = room.removePlayer(playerId);
          if (roomEmpty) {
            return { result: { success: true, roomEmpty: true }, changed: true };
          }
          return { result: { success: true, roomEmpty: false }, changed: true };
        }

        default:
          return { result: { success: false, error: `Unknown action: ${actionName}` }, changed: false };
      }
    });

    if (!actionResult.success) {
      return NextResponse.json({ success: false, error: actionResult.error }, { status: 400 });
    }

    // Fetch latest state
    const latestRoom = await roomStore.getRoom(roomCode);
    const state = latestRoom ? latestRoom.getPublicState(playerId) : null;

    return NextResponse.json({
      success: true,
      result: (actionResult as any).result,
      state,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process game action' },
      { status: 500 }
    );
  }
}
