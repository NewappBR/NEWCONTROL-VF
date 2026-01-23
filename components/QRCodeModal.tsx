
import React, { useState, useRef, useEffect } from 'react';
import { Order, CompanySettings } from '../types';
import * as htmlToImage from 'html-to-image';

interface QRCodeModalProps {
  order: Order;
  companySettings: CompanySettings;
  onClose: () => void;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ order, companySettings, onClose }) => {
  const [totalVolumes, setTotalVolumes] = useState(1);
  const [currentView, setCurrentView] = useState(1);
  const [observation, setObservation] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [printMode, setPrintMode] = useState<'A5' | 'TAG'>('A5');

  const labelRef = useRef<HTMLDivElement>(null);

  // GERAÇÃO DE TEXTO PURO FORMATADO
  const generateQRText = (vol: number, total: number, obs: string) => {
    const dateFormatted = order.dataEntrega.split('-').reverse().join('/');
    const clienteLimitado = order.cliente.length > 40 ? order.cliente.substring(0, 40) + '...' : order.cliente;
    const itemLimitado = order.item.length > 60 ? order.item.substring(0, 60) + '...' : order.item;

    return [
      `NEWCOM CONTROL - O.R #${order.or}`,
      order.numeroItem ? `ITEM REF: ${order.numeroItem}` : '',
      `------------------------------`,
      `CLIENTE: ${clienteLimitado}`,
      `ITEM: ${itemLimitado}`,
      `ENTREGA: ${dateFormatted}`,
      `VOLUME: ${vol} / ${total}`,
      `VENDEDOR: ${order.vendedor}`,
      obs ? `OBS: ${obs}` : '',
      `------------------------------`,
      `Check-in Industrial`
    ].filter(Boolean).join('\n');
  };

  const qrData = generateQRText(currentView, totalVolumes, observation);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(qrData)}&ecc=M&margin=2`;

  const downloadImage = async (ref: React.RefObject<HTMLDivElement>, name: string) => {
    if (ref.current) {
      setIsExporting(true);
      try {
        await new Promise(r => setTimeout(r, 400));
        const dataUrl = await htmlToImage.toPng(ref.current, { 
          quality: 1, 
          backgroundColor: '#ffffff',
          pixelRatio: 2,
          cacheBust: true
        });
        const link = document.createElement('a');
        link.download = `${name}_OR${order.or}_VOL${currentView}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Erro na exportação:', err);
      } finally {
        setIsExporting(false);
      }
    }
  };

  const handlePrintBatch = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let htmlContent = '';
    let styleContent = '';

    if (printMode === 'A5') {
        // --- LÓGICA A5 ---
        styleContent = `
            @page { size: A5 portrait; margin: 0; }
            body { margin: 0; padding: 0; font-family: sans-serif; background: #fff; }
            .label-page {
                width: 148mm;
                height: 210mm;
                border: 10px solid black;
                padding: 20px;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                page-break-after: always;
                background: white;
            }
            .label-page:last-child { page-break-after: avoid; }
        `;

        htmlContent = Array.from({ length: totalVolumes }).map((_, i) => {
            const vol = i + 1;
            const volQrData = generateQRText(vol, totalVolumes, observation);
            const volQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(volQrData)}&ecc=M&margin=0`;
            
            return `
             <div class="label-page">
                 <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                 <div style="display:flex; gap:15px; align-items:center;">
                     ${companySettings.logoUrl ? `<img src="${companySettings.logoUrl}" style="width:50px; height:50px; object-fit:contain; filter:grayscale(100%);">` : ''}
                     <div>
                         <h1 style="margin:0; font-size:24px; font-weight:900; line-height:1;">${companySettings.name}</h1>
                         <p style="margin:2px 0 0; font-size:10px; letter-spacing:3px; font-weight:bold; color:#666;">GRUPO NEWCOM</p>
                     </div>
                 </div>
                 <div style="text-align:right;">
                     <div style="background:black; color:white; padding:4px 8px; font-size:10px; font-weight:bold; display:inline-block;">DOC. INDUSTRIAL</div>
                     <p style="margin:4px 0 0; font-size:10px; font-weight:bold;">DATA: ${new Date().toLocaleDateString('pt-BR')}</p>
                 </div>
                 </div>
     
                 <div style="height:4px; background:black; margin-bottom:15px; width:100%;"></div>
     
                 <div style="display:grid; grid-template-columns: 1fr 1fr; border-bottom:4px solid black; padding-bottom:10px; margin-bottom:10px;">
                     <div style="border-right:3px solid black; padding-right:15px;">
                         <span style="display:block; font-size:10px; font-weight:bold; color:#999; letter-spacing:1px; margin-bottom:4px;">REMETENTE</span>
                         <p style="margin:0; font-size:12px; font-weight:900; line-height:1.2;">${companySettings.name}</p>
                         <p style="margin:2px 0 0; font-size:9px; color:#666;">${companySettings.address}</p>
                     </div>
                     <div style="padding-left:15px;">
                         <span style="display:block; font-size:10px; font-weight:bold; color:#999; letter-spacing:1px; margin-bottom:4px;">DESTINATÁRIO</span>
                         <p style="margin:0; font-size:24px; font-weight:900; line-height:1; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${order.cliente}</p>
                     </div>
                 </div>
     
                 <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:10px 0;">
                     <span style="font-size:12px; font-weight:900; color:#ccc; letter-spacing:6px;">REGISTRO DE ORDEM</span>
                     <h2 style="margin:5px 0 5px; font-size:80px; font-weight:900; line-height:0.8;">#${order.or}</h2>
                     ${order.numeroItem ? `<div style="font-size:16px; font-weight:bold; color:#000; margin-bottom:15px; padding:2px 10px; border:2px solid #000;">REF: ${order.numeroItem}</div>` : `<div style="margin-bottom:20px;"></div>`}
                     
                     <div style="position:relative; padding:10px; border:6px solid black;">
                         <img src="${volQrUrl}" style="width:160px; height:160px;">
                     </div>
                 </div>
     
                 <div style="border-top:4px solid black; padding-top:15px; margin-top:10px;">
                     <div style="display:grid; grid-template-columns: 2fr 1fr; gap:10px;">
                         <div>
                             <span style="display:block; font-size:10px; font-weight:bold; color:#999; letter-spacing:1px; margin-bottom:4px;">ESPECIFICAÇÃO</span>
                             <p style="margin:0; font-size:16px; font-weight:900; line-height:1.2; font-style:italic;">${order.item}</p>
                         </div>
                         <div style="text-align:right; border-left:3px solid black; padding-left:10px;">
                             <span style="display:block; font-size:10px; font-weight:bold; color:#999; letter-spacing:1px; margin-bottom:4px;">ENTREGA</span>
                             <p style="margin:0; font-size:20px; font-weight:900;">${order.dataEntrega.split('-').reverse().join('/')}</p>
                         </div>
                     </div>
                     ${observation ? `
                     <div style="margin-top:10px; border-top:1px solid #ccc; padding-top:5px;">
                         <span style="font-size:8px; font-weight:bold; color:#999;">OBS VOLUME:</span>
                         <span style="font-size:10px; font-weight:bold; font-style:italic;">${observation}</span>
                     </div>` : ''}
                 </div>
     
                 <div style="height:6px; background:black; margin:15px 0;"></div>
     
                 <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                     <div>
                         <p style="margin:0; font-size:14px; font-weight:900;">FLUXO OPERACIONAL</p>
                         <p style="margin:4px 0 0; font-size:10px; font-weight:bold; color:#999; letter-spacing:2px;">SISTEMA NEWCOM</p>
                     </div>
                     <div style="text-align:right;">
                         <span style="display:block; font-size:10px; font-weight:bold; color:#999; letter-spacing:3px;">VOLUME</span>
                         <div style="font-size:50px; font-weight:900; line-height:0.8;">
                             ${vol}<span style="font-size:20px; color:#ccc; margin:0 5px;">/</span><span style="color:#999;">${totalVolumes}</span>
                         </div>
                     </div>
                 </div>
             </div>
            `;
         }).join('');

    } else {
        // --- LÓGICA TAG ---
        styleContent = `
            @page { size: 150mm 150mm; margin: 0; }
            body { margin: 0; padding: 0; font-family: sans-serif; background: #fff; }
            .label-page {
                width: 150mm;
                height: 150mm;
                border: 12px solid black;
                padding: 15px;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                page-break-after: always;
                background: white;
            }
            .label-page:last-child { page-break-after: avoid; }
            .inner-border {
                width: 100%;
                height: 100%;
                border: 8px solid black;
                padding: 10px;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: space-between;
            }
        `;

        htmlContent = Array.from({ length: totalVolumes }).map((_, i) => {
            const vol = i + 1;
            const volQrData = generateQRText(vol, totalVolumes, observation);
            const volQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(volQrData)}&ecc=M&margin=2`;

            return `
                <div class="label-page">
                    <div class="inner-border">
                        <div style="flex:1; width:100%; display:flex; align-items:center; justify-content:center; padding: 10px; overflow:hidden;">
                            <img src="${volQrUrl}" style="max-width:100%; max-height:100%; object-fit:contain;">
                        </div>
                        <div style="text-align:center; width:100%; padding-top:5px;">
                            <h3 style="font-size:32px; font-weight:900; margin:0 0 5px 0; font-style:italic;">#${order.or}</h3>
                            ${order.numeroItem ? `<p style="margin:0 0 5px 0; font-weight:bold; font-size:12px;">ITEM: ${order.numeroItem}</p>` : ''}
                            <div style="width:30%; height:3px; background:#000; margin:0 auto 8px auto;"></div>
                            <p style="font-size:16px; font-weight:900; text-transform:uppercase; color:#000; margin:0; line-height:1.1; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
                                ${order.cliente}
                            </p>
                            <p style="font-size:20px; font-weight:900; margin-top:8px; color: #666;">
                                ${vol} <span style="font-size:14px; color:#ccc;">/</span> <span style="color:#999;">${totalVolumes}</span>
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    printWindow.document.write(`
       <!DOCTYPE html>
       <html>
       <head>
         <title>Etiquetas O.R ${order.or}</title>
         <style>
             ${styleContent}
             * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
         </style>
       </head>
       <body>
          ${htmlContent}
          <script>
             window.onload = function() { window.print(); }
          </script>
       </body>
       </html>
    `);
    printWindow.document.close();
  };

  const LabelA5Template = ({ volIndex }: { volIndex: number }) => (
    <div className="bg-white w-[148mm] h-[210mm] border-[10px] border-black p-8 flex flex-col font-sans text-black select-none overflow-hidden relative shadow-none print:shadow-none print:border-black box-border">
      
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-4 flex-1">
          {companySettings.logoUrl && (
             <img src={companySettings.logoUrl} className="w-16 h-16 object-contain grayscale" alt="Logo" />
          )}
          <div>
            <h1 className="text-[28px] font-[950] leading-none tracking-tight uppercase">{companySettings.name}</h1>
            <p className="text-[8px] font-black tracking-[4px] uppercase text-black/40 mt-1">GRUPO NEWCOM</p>
          </div>
        </div>
        <div className="text-right flex flex-col items-end shrink-0">
          <div className="bg-black text-white px-3 py-1 text-[8px] font-black uppercase tracking-[1px] inline-block print:bg-black print:text-white">DOC. INDUSTRIAL</div>
          <p className="text-[8px] font-black uppercase mt-1 tabular-nums">DATA: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      <div className="w-full h-[4px] bg-black mb-4 print:bg-black"></div>

      <div className="grid grid-cols-2 border-b-[4px] border-black pb-2 print:border-black">
        <div className="pr-4 border-r-[3px] border-black min-h-[50px] flex flex-col justify-center print:border-black">
          <span className="text-[8px] font-black text-black/30 uppercase tracking-[1px] mb-1 block">REMETENTE</span>
          <p className="text-[10px] font-black uppercase leading-tight truncate">{companySettings.name}</p>
          <p className="text-[7px] font-bold text-black/50 mt-0.5 leading-tight truncate uppercase">{companySettings.address}</p>
        </div>
        <div className="pl-4 min-h-[50px] flex flex-col justify-center">
          <span className="text-[8px] font-black text-black/30 uppercase tracking-[1px] mb-1 block">DESTINATÁRIO / CLIENTE</span>
          <p className="text-[22px] font-[950] uppercase leading-[0.9] tracking-tight line-clamp-2">
            {order.cliente}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-2">
        <span className="text-[12px] font-black text-black/10 uppercase tracking-[8px] mb-1">REGISTRO DE ORDEM</span>
        <h2 className="text-[90px] font-[950] leading-none tracking-[-0.05em] tabular-nums mb-1">
          #{order.or}
        </h2>
        {order.numeroItem && (
            <div className="border-2 border-black px-4 py-1 mb-4 font-bold text-sm uppercase">ITEM: {order.numeroItem}</div>
        )}

        <div className="relative">
          <div className="bg-white border-[6px] border-black p-3 w-[180px] h-[180px] flex items-center justify-center print:border-black">
            <img src={qrUrl} alt="QR" className="w-full h-full object-contain" />
          </div>
          <div className="absolute -top-4 -left-4 w-8 h-8 border-t-[6px] border-l-[6px] border-black print:border-black"></div>
          <div className="absolute -top-4 -right-4 w-8 h-8 border-t-[6px] border-r-[6px] border-black print:border-black"></div>
          <div className="absolute -bottom-4 -left-4 w-8 h-8 border-b-[6px] border-l-[6px] border-black print:border-black"></div>
          <div className="absolute -bottom-4 -right-4 w-8 h-8 border-b-[6px] border-r-[6px] border-black print:border-black"></div>
        </div>
      </div>

      <div className="mt-2 border-t-[4px] border-black pt-3 print:border-black">
        <div className="grid grid-cols-12 gap-0 items-start mb-3">
          <div className="col-span-8 pr-4">
            <span className="text-[8px] font-black text-black/30 uppercase tracking-[1px] block mb-1">ESPECIFICAÇÃO DO PRODUTO</span>
            <p className="text-[15px] font-[950] uppercase leading-[1.1] italic tracking-tight line-clamp-2">
              {order.item}
            </p>
          </div>
          <div className="col-span-4 pl-4 border-l-[3px] border-black text-right print:border-black">
            <span className="text-[8px] font-black text-black/30 uppercase tracking-[1px] block mb-1">ENTREGA</span>
            <p className="text-[24px] font-[950] tabular-nums leading-none tracking-tight">
              {order.dataEntrega.split('-').reverse().join('/')}
            </p>
          </div>
        </div>

        <div className="border-t-[2px] border-black pt-2 grid grid-cols-12 items-end print:border-black">
          <div className="col-span-9">
            <span className="text-[8px] font-black text-black/30 uppercase tracking-[1px] block mb-1">OBSERVAÇÕES DO VOLUME</span>
            <p className="text-[8px] font-black uppercase leading-tight italic tracking-tighter line-clamp-2">
              {observation || "CARGA INDUSTRIAL - MANUSEAR COM CUIDADO"}
            </p>
          </div>
          <div className="col-span-3 text-right">
            <span className="text-[8px] font-black text-black/30 uppercase tracking-[1px] block mb-1">VENDEDOR</span>
            <p className="text-[14px] font-[950] uppercase tracking-tight">{order.vendedor}</p>
          </div>
        </div>
      </div>

      <div className="w-full h-[6px] bg-black my-3 print:bg-black"></div>

      <div className="flex justify-between items-end pb-2">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-black text-white flex items-center justify-center rounded-lg shadow-inner print:bg-black print:text-white print-color-adjust-exact">
             {companySettings.logoUrl ? (
               <img src={companySettings.logoUrl} className="w-10 h-10 object-contain invert" alt="MinLogo" />
             ) : (
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L4 7L12 12L20 7L12 2Z" fill="currentColor" fillOpacity="0.4"/>
                  <path d="M12 12L4 17L12 22L20 17L12 12Z" fill="currentColor" fillOpacity="0.2"/>
                  <path d="M4 7V17L12 12L4 7Z" fill="currentColor" fillOpacity="0.7"/>
                  <path d="M20 7V17L12 12L20 7Z" fill="currentColor"/>
               </svg>
             )}
          </div>
          <div>
            <p className="text-[14px] font-[950] uppercase leading-none tracking-tight">FLUXO OPERACIONAL</p>
            <p className="text-[8px] font-black text-black/30 uppercase tracking-[2px] mt-1">SISTEMA INTEGRADO NEWCOM</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[8px] font-black text-black/20 uppercase tracking-[4px] block mb-0.5">CONTROLE DE VOLUMES</span>
          <div className="text-[60px] font-[950] leading-[0.6] tracking-tight tabular-nums flex items-end justify-end">
            {volIndex}<span className="text-[24px] opacity-10 mx-1 mb-2 font-black">/</span><span className="opacity-40">{totalVolumes}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const TagTemplate = () => (
    <div className="bg-white w-[150mm] h-[150mm] p-8 flex flex-col items-center justify-center font-sans text-black border-[12px] border-black relative overflow-hidden print:border-black box-border">
       <div className="w-full h-full border-[10px] border-black p-4 flex flex-col items-center justify-center print:border-black">
          <div className="w-[320px] h-[320px] mb-4 relative flex items-center justify-center overflow-hidden">
             <img src={qrUrl} alt="QR TAG" className="w-full h-full object-contain" />
          </div>
          <div className="text-center w-full px-2">
             <h3 className="text-[12px] font-[950] leading-none tracking-widest uppercase mb-1">#{order.or}</h3>
             {order.numeroItem && <p className="text-[10px] font-bold mb-2 uppercase">ITEM: {order.numeroItem}</p>}
             <div className="w-[30%] h-[2px] bg-black/10 mx-auto mb-2 print:bg-gray-300"></div>
             <p className="text-[10px] font-black uppercase tracking-[4px] text-black/40 truncate leading-tight">
               {order.cliente}
             </p>
          </div>
       </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/95 backdrop-blur-xl md:p-4 overflow-hidden">
      <div className="w-full h-full md:max-w-[1200px] md:h-full md:max-h-[92vh] flex flex-col md:flex-row bg-white dark:bg-slate-900 md:rounded-[32px] shadow-4xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
        
        {/* --- MOBILE LAYOUT: CONTROLS TOP / PREVIEW BOTTOM (SCROLLABLE) --- */}
        
        {/* SIDEBAR / CONTROLS */}
        <div className="w-full md:w-[320px] shrink-0 bg-slate-50 dark:bg-slate-800 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 flex flex-col p-4 md:p-6 space-y-4 md:space-y-5 z-20 shadow-md md:shadow-none">
          <div className="flex justify-between items-center md:block">
            <div>
              <h4 className="text-lg md:text-xl font-[950] text-slate-900 dark:text-white uppercase tracking-tighter leading-none">ETIQUETA CONTROL</h4>
              <p className="text-[8px] md:text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[4px] mt-1 italic">GRUPO NEWCOM</p>
            </div>
            <button onClick={onClose} className="md:hidden p-2 text-slate-400">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg>
            </button>
          </div>

          <div className="flex gap-1 p-1 bg-slate-200 dark:bg-slate-700 rounded-xl">
            <button onClick={() => setPrintMode('A5')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${printMode === 'A5' ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 dark:text-slate-400 hover:text-slate-600'}`}>Etiqueta A5</button>
            <button onClick={() => setPrintMode('TAG')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${printMode === 'TAG' ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 dark:text-slate-400 hover:text-slate-600'}`}>Tag 15x15</button>
          </div>

          <div className="space-y-3 md:space-y-4 flex-1">
            <div className="space-y-1 md:space-y-2">
              <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[3px] ml-1">Total de Volumes</label>
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <button onClick={() => setTotalVolumes(Math.max(1, totalVolumes - 1))} className="w-9 h-9 bg-slate-50 dark:bg-slate-800 rounded-lg font-black text-lg text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-90">-</button>
                <div className="flex-1 text-center font-[950] text-2xl tabular-nums text-slate-900 dark:text-white">{totalVolumes}</div>
                <button onClick={() => setTotalVolumes(totalVolumes + 1)} className="w-9 h-9 bg-slate-50 dark:bg-slate-800 rounded-lg font-black text-lg text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-90">+</button>
              </div>
            </div>

            <div className="space-y-1 md:space-y-2">
              <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[3px] ml-1">Info. Extra</label>
              <textarea 
                value={observation}
                onChange={e => setObservation(e.target.value.toUpperCase())}
                placeholder="EX: FRÁGIL, LADO PARA CIMA..."
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-2xl text-[11px] font-bold uppercase outline-none h-16 md:h-24 resize-none transition-all shadow-inner focus:ring-2 ring-emerald-500/10"
              />
            </div>
          </div>

          <div className="space-y-2 md:space-y-3 pt-2 md:pt-3 border-t border-slate-200 dark:border-slate-700">
            <button 
              onClick={handlePrintBatch}
              className="w-full py-3 md:py-4 bg-black dark:bg-emerald-600 text-white rounded-2xl font-black text-[10px] md:text-[11px] uppercase tracking-widest shadow-xl hover:bg-emerald-900 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeWidth="2.5"/></svg>
              🖨️ Imprimir (BT/Rede)
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => downloadImage(labelRef, printMode)} disabled={isExporting} className="py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-50 transition-all">PNG</button>
              <button onClick={onClose} className="hidden md:block py-2.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Sair</button>
            </div>
          </div>
        </div>

        {/* PREVIEW AREA */}
        <div className="flex-1 bg-slate-200 dark:bg-slate-950 p-4 md:p-8 flex flex-col items-center justify-center overflow-auto relative">
          <div className="absolute top-4 left-4 md:top-6 md:left-6 text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[4px] bg-white/50 dark:bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm z-10 pointer-events-none">
             Preview {currentView} / {totalVolumes}
          </div>
          
          <div className={`transition-all duration-500 origin-center bg-white shadow-2xl shrink-0 my-auto ${printMode === 'A5' ? 'scale-[0.22] xs:scale-[0.28] sm:scale-[0.35] md:scale-[0.35] lg:scale-[0.45] xl:scale-[0.55]' : 'scale-[0.25] xs:scale-[0.35] sm:scale-[0.4] lg:scale-[0.5]'}`}>
             <div ref={labelRef}>
                {printMode === 'A5' ? <LabelA5Template volIndex={currentView} /> : <TagTemplate />}
             </div>
          </div>

          <div className="flex items-center gap-4 bg-black/90 dark:bg-white/10 px-6 py-2.5 rounded-full text-white shadow-2xl z-10 mt-4 md:absolute md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:mt-0">
             <button onClick={() => setCurrentView(Math.max(1, currentView - 1))} className="p-1 hover:text-emerald-400 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="3"/></svg></button>
             <span className="text-[11px] font-[950] uppercase tracking-widest tabular-nums">{currentView} / {totalVolumes}</span>
             <button onClick={() => setCurrentView(Math.min(totalVolumes, currentView + 1))} className="p-1 hover:text-emerald-400 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="3"/></svg></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
