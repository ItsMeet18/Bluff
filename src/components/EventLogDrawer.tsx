'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GameEventLog } from '../types/game';
import { ScrollText, ChevronDown, ChevronUp, History } from 'lucide-react';
import { clsx } from 'clsx';

interface EventLogDrawerProps {
  logs: GameEventLog[];
}

export const EventLogDrawer: React.FC<EventLogDrawerProps> = ({ logs }) => {
  const [isOpen, setIsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  const lastLog = logs[logs.length - 1];

  return (
    <div className="fixed top-16 right-4 z-20 w-72 sm:w-80 select-none">
      {/* Mini preview bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="glass-panel rounded-xl p-2.5 shadow-lg border border-slate-700/80 cursor-pointer flex items-center justify-between gap-2 hover:border-amber-500/50 transition-colors"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <ScrollText className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs text-slate-300 font-medium truncate">
            {lastLog ? lastLog.message : 'Game Event Log'}
          </span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>

      {/* Expanded Log Drawer */}
      {isOpen && (
        <div className="glass-panel mt-1.5 rounded-xl p-3 border border-slate-700 shadow-2xl max-h-60 overflow-y-auto space-y-2 text-xs">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400">
            <span className="flex items-center gap-1">
              <History className="w-3.5 h-3.5 text-amber-400" /> Activity History
            </span>
            <span>{logs.length} Events</span>
          </div>

          <div className="space-y-1.5">
            {logs.map(log => {
              const typeColor = {
                join: 'text-emerald-400',
                leave: 'text-rose-400',
                start: 'text-amber-400 font-bold',
                play: 'text-slate-200',
                pass: 'text-slate-400',
                challenge: 'text-amber-300 font-semibold',
                round_reset: 'text-sky-400',
                win: 'text-yellow-400 font-black',
              }[log.type];

              return (
                <div
                  key={log.id}
                  className={clsx('p-1.5 rounded bg-slate-900/60 leading-tight', typeColor)}
                >
                  <p>{log.message}</p>
                  <span className="text-[9px] text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </div>
  );
};
