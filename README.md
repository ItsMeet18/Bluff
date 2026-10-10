# 🃏 BLUFF — Real-Time Online Multiplayer Card Game

> *"Play your cards. Trust nobody."*

A full-stack, real-time multiplayer implementation of the classic deception card game **BLUFF** (also known as *Cheat* or *I Doubt It*), built with Next.js, React, TypeScript, Tailwind CSS, and Socket.IO.

---

## 🌟 Features

- **Server-Authoritative Architecture:** The game state, card ownership, turn validation, deck shuffling, and bluff resolution are computed strictly on the server.
- **Card Privacy by Design:** The server filters each player's state—clients never receive opponents' private cards or concealed pile identities.
- **Multi-Deck Support:** Host can configure games with 1 to 5 standard 52-card decks (up to 260 cards) with unique card IDs.
- **Dynamic Multiplayer Rooms & Direct Invite Links:**
  - Fast 6-character room codes with unambiguous alphanumeric characters.
  - Direct 1-click room code and full URL invite link sharing (`https://domain.com?room=ABC123`).
  - Seamless invite flow: invited players enter their name and are automatically seated in the room.
  - Real-time waiting room with live player list and host badge.
- **Complete Bluff Rules Engine:**
  - **Starting a Round:** Player plays 1+ cards face down and declares any rank (Aces through Kings).
  - **Adding to Pile:** Subsequent players play cards following the declared rank.
  - **Calling Bluff:** Challenger selects exactly ONE card from the most recent play using a scrollable, responsive modal. The card is revealed:
    - *If Rank != Declared Rank (Bluff):* Challenged player collects the entire central block. Successful challenger starts the next round.
    - *If Rank == Declared Rank (Truth):* Challenger collects the entire central block. Challenged player starts the next round.
  - **Consecutive Passes:** If all players pass consecutively without anyone playing or challenging, the block is cleared to discard without awarding cards to anyone. The player who made the most recent card play into the block retains the turn.
  - **True Victory Condition:** A player with 0 cards is only declared the winner after any challenge against their final play is resolved.
- **Luxury Table UI & Aesthetics:**
  - Emerald felt table texture with 3D stacked card piles.
  - Sequential numbered card selection badges (`1`, `2`, `3`, ...) replacing static checkmarks.
  - Convenient `Select All` and `Deselect All` controls.
  - Prominent pulsating `YOUR TURN` indicator banner and action panel glow.
  - Responsive modals with non-scrolling sticky headers/footers and independent vertical scroll areas.
  - Live activity event log and cinematic challenge resolution banners.
  - Celebratory victory modal with confetti effects (`canvas-confetti`).
  - Immersive sound effects synthesized in real time via the Web Audio API (with mute toggle).
- **Graceful Disconnection & Reconnection:** Session tokens allow players to recover their exact hand and status upon reconnecting or refreshing.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js (App Router), React 18, TypeScript, Tailwind CSS, Lucide React, Framer Motion, Canvas Confetti.
- **Backend:** Node.js, Custom HTTP Server, Socket.IO.
- **Testing:** Vitest (21 automated unit and E2E multiplayer test cases covering all 20 required scenarios).

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18.0.0 or higher)
- npm or yarn

### 2. Installation
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Open multiple tabs or windows to play multiplayer locally!

### 4. Run Automated Tests
```bash
npm test
```

### 5. Build for Production
```bash
npm run build
npm start
```

---

## 🧪 Test Coverage (20 Required Scenarios)

The test suite in [`src/__tests__/engine.test.ts`](file:///c:/Users/meets/Bluff/src/__tests__/engine.test.ts) and [`src/__tests__/multiplayer_e2e.test.ts`](file:///c:/Users/meets/Bluff/src/__tests__/multiplayer_e2e.test.ts) covers:

1. Room creation with a configured number of decks.
2. Joining a valid room using its 6-character code.
3. Rejecting invalid, full, and already-started rooms.
4. Correctly shuffling and distributing all cards evenly.
5. Preventing a player from playing cards they do not own.
6. Rejecting moves made out of turn.
7. Adding cards while preserving the active rank.
8. Successfully calling a bluff and awarding the block to the challenged player.
9. Failing to call a bluff and awarding the block to the challenger.
10. Revealing only the selected challenge card from a multi-card play.
11. Resetting the consecutive-pass count when a player adds cards.
12. Clearing the block without awarding it when all players pass.
13. Returning the next turn to the player who made the most recent card play into the block after all players pass.
14. Correctly checking the winner after a block collection.
15. Allowing a player with zero cards to be challenged before confirming the win.
16. Preventing double resolution of a challenge.
17. Preserving state after temporary disconnection and reconnection.
18. Preventing one player from seeing another player's cards in public state.
19. Handling multiple decks with duplicate rank-and-suit combinations using unique card IDs.
20. Supporting a complete multiplayer game from room creation to the winner announcement.
21. Real-time multi-client Socket.IO end-to-end communication lifecycle.

---

## 📂 Project Structure

```
├── server.ts                       # Custom HTTP + Socket.IO Next.js server
├── src/
│   ├── app/
│   │   ├── globals.css             # Felt table styling, glassmorphism, animations
│   │   ├── layout.tsx              # SEO metadata, viewport, fonts
│   │   └── page.tsx                # Main screen orchestrator
│   ├── components/
│   │   ├── CardView.tsx            # Realistic card rendering (front/back/selected)
│   │   ├── Navbar.tsx              # Header with room code, mute, connection status
│   │   ├── LandingView.tsx         # Name entry screen
│   │   ├── LobbyView.tsx           # Create / Join room forms
│   │   ├── WaitingRoomView.tsx     # Waiting lobby with host controls
│   │   ├── GameTable.tsx           # Felt game table layout
│   │   ├── CentralFelt.tsx         # Central card stack and active rank banner
│   │   ├── OpponentPanel.tsx       # Opponent seat with card counts and turn indicator
│   │   ├── PlayerHandTray.tsx      # Player card tray with multi-select and rank picker
│   │   ├── ChallengeModal.tsx      # Interactive card pick for bluff challenge
│   │   ├── ChallengeRevealBanner.tsx # Bluff resolution card flip banner
│   │   ├── EventLogDrawer.tsx      # Live activity log
│   │   └── GameOverModal.tsx       # Winner podium & rematch modal
│   ├── engine/
│   │   ├── deck.ts                 # Multi-deck generation, shuffling, distribution
│   │   └── GameRoom.ts             # Authoritative Bluff game rules engine
│   ├── hooks/
│   │   ├── useGameSocket.ts        # Socket.IO client state and action dispatchers
│   │   └── useSoundEffects.ts      # Web Audio API sound synthesis
│   ├── server/
│   │   ├── RoomManager.ts          # Session management & room registry
│   │   └── socketHandler.ts        # Socket.IO events and filtered broadcasting
│   └── types/
│       └── game.ts                 # Shared TypeScript interfaces & types
└── vitest.config.ts                # Vitest configuration
```
