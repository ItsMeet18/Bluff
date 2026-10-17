'use client';

import React, { useState } from 'react';
import { UserX, AlertTriangle, Loader2 } from 'lucide-react';

interface KickConfirmationModalProps {
  isOpen: boolean;
  targetPlayer: { id: string; name: string } | null;
  onConfirm: (targetPlayerId: string) => Promise<void>;
  onClose: () => void;
  isWaitingRoom?: boolean;
}

export const KickConfirmationModal: React.FC<KickConfirmationModalProps> = ({
  isOpen,
  targetPlayer,
  onConfirm,
  onClose,
  isWaitingRoom = false,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !targetPlayer) return null;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(targetPlayer.id);
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to remove player');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kick-modal-title"
      >
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl -z-10" />

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <h3 id="kick-modal-title" className="text-base sm:text-lg font-bold text-slate-100">
              Kick {targetPlayer.name}?
            </h3>
            <p className="text-xs text-slate-400">
              {isWaitingRoom
                ? 'Remove player from waiting room'
                : 'Remove player and discard their hand'}
            </p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 mb-5 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
          Are you sure you want to kick <strong className="text-amber-300">{targetPlayer.name}</strong> from this room?
          {!isWaitingRoom && (
            <span className="block mt-1 text-slate-400 text-xs">
              Their unplayed cards will be discarded and turn order will advance immediately.
            </span>
          )}
        </p>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs sm:text-sm transition-colors border border-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs sm:text-sm transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Kicking...</span>
              </>
            ) : (
              <>
                <UserX className="w-4 h-4" />
                <span>Kick Player</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
