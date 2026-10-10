# 🃏 BLUFF — Real-Time Online Multiplayer Card Game

> *"Play your cards. Trust nobody. Claim the podium."*

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Upstash Redis](https://img.shields.io/badge/Upstash-Redis-00E599?style=for-the-badge&logo=redis)](https://upstash.com/)
[![Vercel Functions](https://img.shields.io/badge/Vercel-Functions%20WS-black?style=for-the-badge&logo=vercel)](https://vercel.com/)
[![Vitest](https://img.shields.io/badge/Vitest-29%20Tests%20Passing-6E9F18?style=for-the-badge&logo=vitest)](https://vitest.dev/)

**BLUFF** (also known as *Cheat*, *I Doubt It*, or *Bullshit*) is a full-stack, real-time multiplayer card game built from the ground up for the web and engineered specifically for serverless deployment on **Vercel** with **Upstash Redis**.

Players take turns playing cards face down while declaring ranks, challenging opponents' honesty, bluffing their way out of impossible hands, and competing to outlast everyone else.

---

## 🏗️ Vercel-Native Architecture

The game is designed to run completely on **Vercel's Serverless Edge & Node functions** without needing a separate continuous server host like Railway or Render:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Browser                         │
│   (React 18 + Tailwind + Framer Motion + Web Audio API)     │
└──────────────┬───────────────────────────────▲──────────────┘
               │                               │
       REST Actions                    WebSocket / Polling
   (/api/game/*, /api/auth/*)              (/api/ws)
               │                               │
               ▼                               │
┌──────────────────────────────┐ ┌─────────────┴──────────────┐
│   Vercel Serverless Routes   │ │  Vercel WebSocket Function │
│   - Distributed Locking      │ │  - @vercel/functions       │
│   - Atomic State Transitions │ │  - Real-time Sync          │
└──────────────┬───────────────┘ └─────────────┬──────────────┘
               │                               │
               └───────────────┬───────────────┘
                               ▼
            ┌────────────────────────────────────┐
            │       Upstash Redis / Vercel KV    │
            │   - Distributed Lock Keys          │
            │   - Authoritative Game Room State  │
            │   - Active Rooms Discovery Index   │
            │   - Player Session Store           │
            └────────────────────────────────────┘
```

1. **Atomic Concurrency & Distributed Locking (`runAtomic`):**
   - Each state-modifying action (playing cards, passing, calling bluff, rematches) acquires a distributed Redis lock (`bluff:lock:{roomCode}`).
   - State version increments monotonically on every mutation, preventing race conditions when players act concurrently.
2. **Authoritative State Serialization (`toJSON()` / `fromJSON()`):**
   - Game rooms and player hands are serialized to Upstash Redis with safe time-to-live (`TTL`).
   - Private card data is strictly hidden on the server; clients only receive their own private cards and public game state.
3. **Real-Time Communication:**
   - Real-time events and room presence are bridged via `@vercel/functions` WebSocket endpoint (`/api/ws`) with automatic reconnect and fallback sync polling.

---

## 🌟 Key Highlights & Features

### 🎮 Gameplay & Game Rules
- **Server-Authoritative Game Engine:** Turn validation, deck distribution, bluff evaluation, and elimination lifecycles are processed strictly on the server.
- **Strict Card Privacy:** The server filters each player's state—clients never receive opponents' private cards, concealed deck orders, or hidden pile identities.
- **Configurable Multi-Decks:** Play with 1 to 5 standard 52-card decks (up to 260 unique cards) for scalable matches from 2 to 8 players.
- **Elimination & Spectator Lifecycle:** When a player empties their hand, they remain active until the round resolves. If unchallenged or unpenalized, they transition into a spectator while remaining players continue battling.
- **Special Two-Player Endgame Victory:** When only two active players remain and Player A plays their final cards, if Player B adds cards to the block without challenging, Player A immediately wins under the authoritative two-player endgame rule.

---

## 🏆 Personality Finishing Titles

Numerical finishes (`1st`, `2nd`, `3rd`, `Last`) are replaced with personality-driven custom titles:

| Finishing Position | Custom Title | Visual Theme | Tagline |
|---|---|---|---|
| **1st Place** | **`Main Character Energy`** | 🌟 Gold Winner Glow | *Undisputed champion of the table.* |
| **2nd Place** | **`The Silver Surfer`** | 🥈 Metallic Silver | *So close yet so far from the crown.* |
| **3rd Place** | **`Bronze-Tier Flex`** | 🥉 Polished Bronze | *Made podium and made sure everyone knew.* |
| **4th Place** | **`Honorable Mention`** | 🛡️ Elegant Indigo | *Solid performance, just outside the medals.* |
| **5th Place** | **`I Was Top 5!`** | 🔥 Vibrant Cyan | *A victory in their own record book.* |
| **Mid Positions** | **`Not worth my time`** | ⏱️ Muted Slate | *Already thinking about the next round.* |
| **Second-to-Last** | **`Clutch God`** | ⚡ Dramatic Purple | *Survived elimination by the skin of their teeth.* |
| **Last Place** | **`Bro is Not Him`** | 💀 Defeat Rose | *Walked into every single bluff trap.* |

---

## 🌐 Room Discovery & Multiplayer Lobby

- **Live Active Rooms Section:** A live lobby list above the manual code entry displays currently open, waiting rooms with real-time updates:
  - Room Code
  - Host Display Name
  - Player Count (e.g. `2/6 Players`)
  - Deck Configuration
  - Instant One-Click `Join Room`
- **Join via 6-Character Code:** Unambiguous alphanumeric codes (`A-Z`, `2-9`).
- **Direct 1-Click Invite Links:** Share URL invites like `https://bluffbymeet.vercel.app/?room=ABC123`—friends join automatically upon entering their name.
- **Instant Rematches:** Clean room resets with zero leftover titles, state leaks, or stale connections.

---

## 🚀 Setup & Environment Variables

### 1. Vercel & Upstash Redis Integration
1. Go to your project on the [Vercel Dashboard](https://vercel.com/dashboard).
2. Navigate to **Storage** tab -> Click **Create Database** -> Choose **Upstash Redis** (or **Vercel KV**).
3. Connect the database to your project. Vercel will automatically set the following environment variables:
   - `UPSTASH_REDIS_REST_URL` / `KV_REST_API_URL`
   - `UPSTASH_REDIS_REST_TOKEN` / `KV_REST_API_TOKEN`

### 2. Local Environment (`.env.local`)
Create a `.env.local` file in the root directory:
```env
# Upstash Redis / Vercel KV REST API Credentials
UPSTASH_REDIS_REST_URL="https://your-database-id.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_upstash_rest_token_here"
```

> **Note:** If no Redis credentials are provided during local testing or unit tests, the system automatically falls back to an in-memory storage adapter.

---

## 🛠️ Development & Testing

### Installation
```bash
pnpm install
# or
npm install
```

### Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Automated Tests
```bash
npm test
```
Runs the full suite of Vitest unit & integration tests covering game rules, atomic Redis locking, concurrent plays, bluff challenges, and room discovery.

### Production Build
```bash
npm run build
```

---

## 🚢 Deployment to Vercel

1. Push your repository to GitHub / GitLab / Bitbucket.
2. Import the repository in [Vercel](https://vercel.com).
3. Link the **Upstash Redis** or **Vercel KV** database in the **Storage** tab.
4. Deploy! Standard Next.js builds work out of the box with zero custom server configurations required.
