import React, { useEffect } from 'react';
import gsap from 'gsap';
import { Keyboard, X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';

export interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'RTL' | 'LTR';
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  onClose,
  mode = 'RTL',
}) => {
  const modalRef = useFocusTrap<HTMLDivElement>({
    isOpen,
    onClose,
  });

  useEffect(() => {
    if (isOpen && modalRef.current) {
      gsap.fromTo(
        modalRef.current,
        { opacity: 0, scale: 0.94, y: 15 },
        { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'power3.out' }
      );
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      aria-describedby="shortcuts-modal-desc"
      data-testid="shortcuts-hud-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity select-none"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0f172a]/95 border border-white/10 rounded-2xl p-6 shadow-2xl text-white transform-gpu relative outline-none"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 id="shortcuts-modal-title" className="text-base font-bold text-gray-100">
                Atajos de Teclado
              </h3>
              <p id="shortcuts-modal-desc" className="text-xs text-slate-400">
                Navegación rápida y controles ergonómicos
              </p>
            </div>
          </div>
          <button
            data-testid="close-hud-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts Guide */}
        <div className="space-y-2.5 font-sans text-sm">
          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
            <span className="text-slate-300">Avanzar página</span>
            <div className="flex items-center gap-1.5">
              <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
                {mode === 'RTL' ? '←' : '→'}
              </kbd>
              <span className="text-xs text-slate-500">o</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
                D
              </kbd>
              <span className="text-xs text-slate-500">o</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
                Espacio
              </kbd>
            </div>
          </div>

          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
            <span className="text-slate-300">Retroceder página</span>
            <div className="flex items-center gap-1.5">
              <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
                {mode === 'RTL' ? '→' : '←'}
              </kbd>
              <span className="text-xs text-slate-500">o</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
                A
              </kbd>
            </div>
          </div>

          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
            <span className="text-slate-300">Pantalla completa</span>
            <kbd className="px-2.5 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
              F
            </kbd>
          </div>

          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
            <span className="text-slate-300">Doble página (enfrentadas)</span>
            <kbd className="px-2.5 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
              W
            </kbd>
          </div>

          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
            <span className="text-slate-300">Alternar modo lectura (Webtoon / Manga)</span>
            <kbd className="px-2.5 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
              M
            </kbd>
          </div>

          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
            <span className="text-slate-300">Ajustes visuales y filtros</span>
            <kbd className="px-2.5 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
              V
            </kbd>
          </div>

          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
            <span className="text-slate-300">Alternar tema de fondo</span>
            <kbd className="px-2.5 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
              T
            </kbd>
          </div>

          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
            <span className="text-slate-300">Ver / ocultar controles</span>
            <kbd className="px-2.5 py-0.5 text-xs font-mono bg-slate-800 text-cyan-400 border border-slate-700 rounded shadow-sm">
              Esc
            </kbd>
          </div>
        </div>

        {/* Footer tip */}
        <div className="mt-5 pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Pulsa <strong className="text-cyan-400">?</strong> para abrir/cerrar esta ayuda</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsModal;
