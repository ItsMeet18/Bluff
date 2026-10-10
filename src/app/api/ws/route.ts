import { experimental_upgradeWebSocket } from '@vercel/functions';
import { roomStore } from '@/server/RedisRoomStore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let sessionToken: string | null = null;
  let roomCode: string | null = null;

  const url = new URL(request.url);
  sessionToken = url.searchParams.get('token') || url.searchParams.get('sessionToken');
  roomCode = url.searchParams.get('room') || url.searchParams.get('roomCode');

  return experimental_upgradeWebSocket(async (client) => {
    client.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        const type = message.type;

        if (type === 'auth') {
          const session = await roomStore.getOrCreateSession(message.sessionToken, message.playerName);
          sessionToken = session.token;
          if (message.roomCode) roomCode = message.roomCode;
          client.send(JSON.stringify({
            type: 'auth_success',
            sessionToken: session.token,
            playerId: session.playerId,
            playerName: session.playerName,
          }));
        } else if (type === 'get_active_rooms') {
          const rooms = await storeOrFetchActiveRooms();
          client.send(JSON.stringify({ type: 'active_rooms_updated', rooms }));
        } else if (type === 'sync') {
          const targetRoom = message.roomCode || roomCode;
          const targetToken = message.sessionToken || sessionToken;
          if (targetRoom) {
            const room = await roomStore.getRoom(targetRoom);
            const session = targetToken ? await roomStore.getSession(targetToken) : null;
            if (room) {
              client.send(JSON.stringify({
                type: 'game_state_updated',
                state: room.getPublicState(session?.playerId),
              }));
            }
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });

    client.on('close', () => {
      // Connection closed
    });
  });
}

async function storeOrFetchActiveRooms() {
  try {
    return await roomStore.getActiveRooms();
  } catch {
    return [];
  }
}
