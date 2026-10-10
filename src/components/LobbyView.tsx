'use client';

import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  LogIn,
  ArrowLeft,
  Layers,
  Users,
  Shield,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Crown,
  Play,
  Radio,
} from 'lucide-react';
import { ActiveRoomSummary } from '../types/game';

interface LobbyViewProps {
  playerName: string;
  onCreateRoom: (deckCount: number, maxPlayers: number) => Promise<{ success: boolean; error?: string }>;
  onJoinRoom: (roomCode: string) => Promise<{ success: boolean; error?: string }>;
  onBack: () => void;
  activeRooms?: ActiveRoomSummary[];
  isLoadingRooms?: boolean;
  roomsError?: string | null;
  onRefreshRooms?: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  playerName,
  onCreateRoom,
  onJoinRoom,
  onBack,
  activeRooms = [],
  isLoadingRooms = false,
  roomsError = null,
  onRefreshRooms,
}) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [deckCount, setDeckCount] = useState<number>(1);
  const [maxPlayers, setMaxPlayers] = useState<number>(6);
  const [roomCode, setRoomCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [joiningRoomCode, setJoiningRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-fetch active rooms when switching to the Join tab
  useEffect(() => {
    if (tab === 'join' && onRefreshRooms) {
      onRefreshRooms();
    }
  }, [tab, onRefreshRooms]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await onCreateRoom(deckCount, maxPlayers);
    if (!res.success) {
      setError(res.error || 'Failed to create room');
    }
    setLoading(false);
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter a 6-character room code');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await onJoinRoom(cleanCode);
    if (!res.success) {
      setError(res.error || 'Failed to join room');
    }
    setLoading(false);
  };

  const handleJoinFromList = async (targetCode: string) => {
    setJoiningRoomCode(targetCode);
    setError(null);
    const res = await onJoinRoom(targetCode);
    if (!res.success) {
      setError(res.error || `Failed to join room ${targetCode}`);
      // Refresh list in case room was filled or started
      if (onRefreshRooms) onRefreshRooms();
    }
    setJoiningRoomCode(null);
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col items-center justify-center px-3 sm:px-4 py-6">
      <div className="w-full max-w-xl mx-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Change Name ({playerName})
          </button>
          <div className="text-xs text-amber-400 font-semibold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Welcome, {playerName}
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex p-1 bg-slate-900/90 border border-slate-800 rounded-xl mb-6 shadow-inner">
          <button
            id="tabCreateRoom"
            type="button"
            onClick={() => {
              setTab('create');
              setError(null);
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              tab === 'create'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4" /> Create Room
          </button>
          <button
            id="tabJoinRoom"
            type="button"
            onClick={() => {
              setTab('join');
              setError(null);
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              tab === 'join'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-4 h-4" /> Join Room
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 text-sm flex items-start gap-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to proceed</p>
              <p className="text-xs text-rose-300/90 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Create Room Form */}
        {tab === 'create' && (
          <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" /> Room Configuration
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Customize your match settings before opening the room to other players.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-6">
              {/* Deck Count */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2.5">
                  Number of Decks ({deckCount * 52} Total Cards)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setDeckCount(num)}
                      className={`py-3 rounded-xl font-bold text-sm border transition-all flex flex-col items-center justify-center cursor-pointer ${
                        deckCount === num
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-glow-gold'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <span>{num}</span>
                      <span className="text-[10px] font-normal opacity-70">
                        {num === 1 ? 'Deck' : 'Decks'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Players */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-400" /> Max Players
                  </label>
                  <span className="text-sm font-bold text-emerald-400">{maxPlayers} Players</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={8}
                  step={1}
                  value={maxPlayers}
                  onChange={e => setMaxPlayers(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 cursor-pointer bg-slate-800 h-2 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                  <span>2 Min</span>
                  <span>4</span>
                  <span>6 Default</span>
                  <span>8 Max</span>
                </div>
              </div>

              {/* Room Visibility Default */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <div>
                    <p className="font-semibold text-slate-200">Public & Joinable</p>
                    <p className="text-[11px] text-slate-400">Discoverable in Active Rooms and via 6-character code</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Joinable
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition-colors text-sm border border-slate-700/60 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  id="createRoomBtn"
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 shadow-glow-gold transition-all text-sm disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Join Room Page: 1. Active Rooms (Above), 2. Join via Room Code (Below) */}
        {tab === 'join' && (
          <div className="space-y-6">
            {/* 1. ACTIVE ROOMS SECTION (Above) */}
            <div className="glass-panel rounded-2xl p-5 sm:p-7 shadow-2xl border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                      Active Rooms
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Join an open match directly from the live lobby list
                    </p>
                  </div>
                </div>

                {onRefreshRooms && (
                  <button
                    type="button"
                    onClick={onRefreshRooms}
                    disabled={isLoadingRooms}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-amber-400 transition-colors text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Refresh active rooms"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRooms ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                )}
              </div>

              {/* Active Rooms Content */}
              {isLoadingRooms && activeRooms.length === 0 ? (
                <div className="py-8 text-center bg-slate-900/60 rounded-xl border border-slate-800/80">
                  <RefreshCw className="w-6 h-6 text-amber-400 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-medium">Scanning for open rooms...</p>
                </div>
              ) : roomsError ? (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 text-center">
                  <p className="text-xs text-rose-300 mb-2">{roomsError}</p>
                  {onRefreshRooms && (
                    <button
                      onClick={onRefreshRooms}
                      className="px-3 py-1.5 rounded-lg bg-rose-800/60 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Try Again
                    </button>
                  )}
                </div>
              ) : activeRooms.length === 0 ? (
                <div className="py-8 px-4 text-center bg-slate-900/60 rounded-xl border border-slate-800/80">
                  <Users className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-slate-300 mb-1">
                    No rooms available right now
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Be the first to start a game or enter a private room code below.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {activeRooms.map(room => (
                    <div
                      key={room.roomCode}
                      className="p-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-900 border border-slate-800/90 hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono font-black text-sm tracking-wider shrink-0">
                          {room.roomCode}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs text-slate-200 font-bold truncate">
                            <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">{room.hostName}&apos;s Room</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                              <Users className="w-3 h-3" /> {room.playerCount}/{room.maxPlayers} Players
                            </span>
                            <span>•</span>
                            <span>{room.deckCount} {room.deckCount === 1 ? 'Deck' : 'Decks'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase tracking-wide">
                          Waiting
                        </span>
                        <button
                          type="button"
                          onClick={() => handleJoinFromList(room.roomCode)}
                          disabled={joiningRoomCode === room.roomCode}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{joiningRoomCode === room.roomCode ? 'Joining...' : 'Join Room'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. JOIN VIA ROOM CODE SECTION (Below) */}
            <div className="glass-panel rounded-2xl p-5 sm:p-7 shadow-2xl border border-slate-800">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-1 flex items-center gap-2">
                <LogIn className="w-5 h-5 text-amber-400" /> Join via Room Code
              </h2>
              <p className="text-xs text-slate-400 mb-5">
                Have a private code? Enter the 6-character code provided by your host.
              </p>

              <form onSubmit={handleJoinSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="roomCodeInput"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
                  >
                    Room Code
                  </label>
                  <input
                    id="roomCodeInput"
                    type="text"
                    value={roomCode}
                    onChange={e => {
                      setRoomCode(e.target.value.toUpperCase());
                      if (error) setError(null);
                    }}
                    maxLength={6}
                    placeholder="e.g. 7X9K2W"
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-amber-400 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-center text-2xl font-black tracking-widest uppercase transition-all"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex-1 py-3 px-4 rounded-xl font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition-colors text-sm border border-slate-700/60 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || roomCode.length < 3}
                    id="joinRoomBtn"
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 shadow-glow-gold transition-all text-sm disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? 'Joining...' : 'Join via Code'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
