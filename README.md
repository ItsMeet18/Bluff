# 🃏 BLUFF — Real-Time Online Multiplayer Card Game

> *"Play your cards. Trust nobody. Claim the podium."*

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-white?style=for-the-badge&logo=socket.io)](https://socket.io/)
[![Vitest](https://img.shields.io/badge/Vitest-43%20Tests%20Passing-6E9F18?style=for-the-badge&logo=vitest)](https://vitest.dev/)

**BLUFF** (also known as *Cheat*, *I Doubt It*, or *Bullshit*) is a full-stack, real-time multiplayer card game built from the ground up for the web. Players take turns playing cards face down while declaring ranks, challenging opponents' honesty, bluffing their way out of impossible hands, and competing to outlast everyone else.

---

## 🌟 Key Highlights & Features

### 🎮 Gameplay & Game Rules
- **Server-Authoritative Game Engine:** Turn validation, deck distribution, bluff evaluation, and elimination lifecycles are processed strictly on the Node.js backend.
- **Strict Card Privacy:** The server filters each player's state—clients never receive opponents' private cards, concealed deck orders, or hidden pile identities.
- **Configurable Multi-Decks:** Play with 1 to 5 standard 52-card decks (up to 260 unique cards) for scalable matches from 2 to 8 players.
- **Elimination & Spectator Lifecycle:** When a player empties their hand, they remain active until the round resolves. If unchallenged or unpenalized, they transition into a spectator while remaining players continue battling.
- **Special Two-Player Endgame Victory:** When only two active players remain and Player A plays their final cards, if Player B adds cards to the block without challenging, Player A immediately wins under the authoritative two-player endgame rule.

---

## 🏆 Personality Finishing Titles

Numerical finishes (`1st`, `2nd`, `3rd`, `Last`) are replaced with personality-driven custom titles:

| Finishing Position | Custom Title | Visual Theme | Tagline |
|---|---|---|---|
| **1st Place** (when not 2p) | **`Main Character Energy`** | 🌟 Gold Winner Glow | *Protagonist status unlocked* |
| **2nd Place** (when not 2p/3p) | **`The Silver Surfer`** | 🥈 Metallic Silver | *Clean runner-up finish* |
| **3rd Place** (5+ players) | **`Bronze-Tier Flex`** | 🥉 Polished Bronze | *Secured the podium* |
| **4th Place** (6+ players) | **`Honorable Mention`** | 🛡️ Elegant Indigo | *Respectable performance* |
| **5th Place** (7+ players) | **`I Was Top 5!`** | 🔥 Vibrant Cyan | *Made the leaderboard* |
| **Mid Positions** (6th to $(N-2)$) | **`Not worth my time`** | ⏱️ Muted Slate | *Barely broke a sweat* |
| **Second-to-Last** ($(N-1)$) | **`Clutch God`** | ⚡ Dramatic Purple/Fuchsia | *Survived till the very final round* |
| **Last Place / Survivor** ($N$) | **`Bro is Not Him`** | 💀 Playful Defeat Rose | *Last player standing defeat* |

> **Mandatory Priority:** The last two positions always reserve **`Clutch God`** (second-to-last) and **`Bro is Not Him`** (last place), regardless of player count:
> - **2 Players:** 1st = `Clutch God`, 2nd = `Bro is Not Him`
> - **3 Players:** 1st = `Main Character Energy`, 2nd = `Clutch God`, 3rd = `Bro is Not Him`
> - **4 Players:** 1st = `Main Character Energy`, 2nd = `The Silver Surfer`, 3rd = `Clutch God`, 4th = `Bro is Not Him`

---

## 🌐 Room Discovery & Multiplayer Lobby

- **Live Active Rooms Section:** A live lobby list above the manual code entry displays currently open, waiting rooms with real-time updates:
  - Room Code
  - Host Display Name
  - Player Count (e.g. `2/6 Players`)
  - Deck Configuration
  - Instant One-Click `Join Room`
- **Join via 6-Character Code:** Unambiguous alphanumeric codes (`A-Z`, `2-9`).
- **Direct 1-Click Invite Links:** Share URL invites like `https://bluff-game.com?room=ABC123`—friends join automatically upon entering their name.
- **Instant Rematches:** Clean room resets with zero leftover titles, state leaks, or stale connections.

---

## 🎨 Luxury Table UI & Audio

- **Casino Emerald Felt Canvas:** Deep green felt background with realistic 3D card stacks, dealer chips, and ambient glow.
- **Numbered Multi-Card Selection:** Cards highlight with sequential badges (`1`, `2`, `3`, ...) replacing static checkboxes.
- **Select All & Clear Controls:** Quickly toggle cards matching the active rank.
- **Interactive Bluff Challenge Modal:** Scrollable, responsive card grid to pick which specific concealed card to challenge.
- **Cinematic Challenge Reveal Banner:** Suspenseful card flip animation declaring `BLUFF!` or `TRUTH!`.
- **Procedural Web Audio Sound Engine:** Pure synthesizers generate real-time card dealing, chip shuffling, turn alerts, and victory chimes without external audio assets.
- **Celebratory Confetti:** High-energy confetti bursts upon match completion.

---

## 🕹️ Game Rules Walkthrough

1. **Starting the Round:** The player whose turn it is plays 1 or more cards face down and declares any rank (e.g., *"Three Kings"*).
2. **Continuing the Round:** Subsequent players in turn order can:
   - **Play Cards:** Add 1 or more cards to the central block (must declare the same active rank).
   - **Pass:** Skip their turn if they cannot or choose not to play.
   - **Call Bluff:** Challenge the most recent player's play by selecting a card from their contribution.
3. **Resolving a Challenge:**
   - **Bluff Caught:** The revealed card does *not* match the declared rank. The challenged player takes all cards from the central block. The successful challenger starts the next round.
   - **Truth Told:** The revealed card matches the declared rank. The challenger takes all cards from the central block. The challenged player starts the next round.
4. **All Players Pass:** If every active player passes consecutively, the central block is discarded without awarding cards to anyone. The player who made the last card play starts the next round.
5. **Winning the Game:** The first player to empty their cards and survive challenge resolution takes 1st place (`Main Character Energy`). Play continues until the final player remaining with cards receives the final standing (`Bro is Not Him`).

---

## 📁 Project Architecture

```
bluff/
├── server.ts                             # Custom HTTP + Socket.IO server
├── src/
│   ├── app/
│   │   ├── api/rooms/route.ts            # GET /api/rooms discovery endpoint
│   │   ├── globals.css                   # Casino felt styles & design tokens
│   │   ├── layout.tsx                    # HTML shell & SEO metadata
│   │   └── page.tsx                      # Main single-page application orchestrator
│   ├── components/
│   │   ├── CardView.tsx                  # 3D interactive playing card component
│   │   ├── CentralFelt.tsx               # Central block stack & active rank banner
│   │   ├── ChallengeModal.tsx            # Scrollable modal for bluff card selection
│   │   ├── ChallengeRevealBanner.tsx     # Card flip challenge resolution banner
│   │   ├── EventLogDrawer.tsx            # Live activity log drawer
│   │   ├── GameOverModal.tsx             # Results modal with custom titles & podium
│   │   ├── GameTable.tsx                 # Main gaming table view
│   │   ├── LandingView.tsx               # Initial player name entry view
│   │   ├── LobbyView.tsx                 # Active Rooms list & Room Code forms
│   │   ├── Navbar.tsx                    # Header with room info, mute & leave buttons
│   │   ├── OpponentPanel.tsx             # Opponent seat with live card count & status
│   │   ├── PlayerHandTray.tsx            # Player hand tray with numbered selection
│   │   └── WaitingRoomView.tsx           # Pre-game lobby & invite sharing
│   ├── engine/
│   │   ├── deck.ts                       # Multi-deck generation, shuffle & deal
│   │   └── GameRoom.ts                   # Authoritative server-side game rules engine
│   ├── hooks/
│   │   ├── useGameSocket.ts              # Socket.IO connection & real-time actions
│   │   └── useSoundEffects.ts            # Web Audio API sound synthesizer
│   ├── server/
│   │   ├── RoomManager.ts                # Session management & active room registry
│   │   └── socketHandler.ts              # Socket.IO event handlers & broadcast filters
│   ├── types/
│   │   └── game.ts                       # Game models, state DTOs & TypeScript types
│   ├── utils/
│   │   └── titles.ts                     # Finishing titles & visual theme generator
│   └── __tests__/
│       ├── titles.test.ts                # Custom title allocation unit tests
│       ├── endgame_and_active_rooms.test.ts # 2-player victory, active rooms & spectator tests
│       ├── engine.test.ts                # Game engine rule verification suite
│       └── multiplayer_e2e.test.ts       # Real-time multi-client Socket.IO E2E tests
├── vitest.config.ts                      # Vitest test runner configuration
└── package.json                          # Scripts & dependencies
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **npm** or **yarn**

### Installation
```bash
# Clone repository
git clone https://github.com/your-username/bluff.git
cd bluff

# Install dependencies
npm install
```

### Running Locally (Development)
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser. Open multiple tabs or different browsers to simulate multiplayer gameplay!

### Running Automated Tests
```bash
npm test
```

### Building for Production
```bash
# Build optimized production bundle
npm run build

# Start production server
npm start
```

---

## 🧪 Test Suite Summary

The automated Vitest test suite contains **43 passing tests** across 4 suites:

1. **`titles.test.ts` (9 tests):**
   - Correct title mappings for 2, 3, 4, 5, 6, 7, 8, 10, and 1 player.
   - Mandatory priority enforcement for `Clutch God` and `Bro is Not Him`.
2. **`endgame_and_active_rooms.test.ts` (10 tests):**
   - **Scenario A:** 2 active players, final-card play $\rightarrow$ opponent adds cards $\rightarrow$ immediate win with no post-game turn loops.
   - **Scenario B:** $>2$ active players $\rightarrow$ final-card play does not prematurely end the match.
   - **Scenario C:** Final-card bluff challenge handling (bluff caught vs. truth told).
   - **Scenario E & F:** Spectator elimination lifecycle and clean rematch state resets.
   - **Active Rooms:** Creation listing, full/in-progress filtering, and room removal.
3. **`engine.test.ts` (20 tests):**
   - Comprehensive rule validation, deck shuffling, turn order, out-of-turn rejection, card ownership verification, and consecutive passes.
4. **`multiplayer_e2e.test.ts` (4 tests):**
   - Multi-client Socket.IO lifecycle, real-time synchronization, challenge resolution, and card privacy enforcement.

---

## 📜 License

Distributed under the MIT License. Feel free to fork, customize, and deploy your own online card room!
