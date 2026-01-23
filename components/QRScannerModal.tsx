
import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerModalProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({ onScanSuccess, onClose }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    
    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" }, // Câmera traseira preferencial
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: window.innerWidth / window.innerHeight
          },
          (decodedText) => {
            // Efeito sonoro simples (opcional)
            // const audio = new Audio('/beep.mp3'); audio.play().catch(() => {});
            html5QrCode.stop().then(() => {
                onScanSuccess(decodedText);
            }).catch(err => console.error("Failed to stop scanner", err));
          },
          (errorMessage) => {
            // Ignorar erros de frames vazios
          }
        );
      } catch (err) {
        setError("Erro ao acessar a câmera. Verifique as permissões.");
        console.error(err);
      }
    };

    startScanner();

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
      html5QrCode.clear().catch(console.error);
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col animate-in fade-in duration-300">
      
      {/* Header Transparente */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-20 bg-gradient-to-b from-black/80 to-transparent pb-12">
        <div>
            <h3 className="text-white font-black uppercase tracking-widest text-lg leading-none">Scanner</h3>
            <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-[2px] mt-1">Busca Rápida de O.R</p>
        </div>
        <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all active:scale-95">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg>
        </button>
      </div>

      {/* Área da Câmera Fullscreen */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
         <div id="reader" className="w-full h-full object-cover"></div>
         
         {/* Overlay Visual de Scanning */}
         <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[70vw] h-[70vw] max-w-[300px] max-h-[300px] border-2 border-white/30 rounded-[32px] relative overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]">
                {/* Cantos */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-[28px]"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-[28px]"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-[28px]"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-[28px]"></div>
                
                {/* Laser Animation */}
                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-[scan_2s_infinite_linear]"></div>
            </div>
         </div>

         {error && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-center w-[80%] z-30">
                <div className="bg-red-500/90 backdrop-blur-md p-6 rounded-2xl border border-red-400/50 shadow-xl">
                    <svg className="w-10 h-10 text-white mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="2"/></svg>
                    <p className="font-bold text-sm uppercase tracking-wide">{error}</p>
                    <button onClick={onClose} className="mt-4 px-6 py-2 bg-white text-red-600 rounded-xl font-black text-xs uppercase">Fechar</button>
                </div>
            </div>
         )}
      </div>

      {/* Footer Instruções */}
      <div className="absolute bottom-0 left-0 right-0 p-8 z-20 text-center pb-safe-bottom">
         <p className="text-white/80 text-xs font-bold uppercase tracking-[2px] animate-pulse drop-shadow-md">
            Aponte a câmera para o código QR
         </p>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        #reader video { object-fit: cover; width: 100%; height: 100%; }
      `}</style>
    </div>
  );
};

export default QRScannerModal;
