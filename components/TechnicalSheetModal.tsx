
import React, { useMemo, useState, useRef } from 'react';
import { Order, CompanySettings, DEPARTMENTS, ProductionStep, Status, User } from '../types';
import { generateTechnicalSheetHtml } from '../utils/printHelpers';
import Logo from './Logo';

interface TechnicalSheetModalProps {
  order: Order;
  allOrders?: Order[]; 
  companySettings: CompanySettings;
  onClose: () => void;
  onEdit: () => void;
  onUpdateStatus: (id: string, field: ProductionStep, next: Status) => void;
  onShowQR: (order: Order) => void;
  currentUser: User | null;
}

const TechnicalSheetModal: React.FC<TechnicalSheetModalProps> = ({ 
  order, 
  allOrders, 
  companySettings, 
  onClose, 
  onEdit, 
  onUpdateStatus, 
  onShowQR,
  currentUser 
}) => {
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [searchRef, setSearchRef] = useState('');
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false); // Estado para recolher cabeçalho
  
  // Swipe State
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const siblingItems = useMemo(() => {
      if (!allOrders) return [order];
      return allOrders
        .filter(o => o.or === order.or)
        .sort((a, b) => {
            const refA = a.numeroItem || '';
            const refB = b.numeroItem || '';
            return refA.localeCompare(refB, undefined, { numeric: true, sensitivity: 'base' });
        });
  }, [order, allOrders]);

  // Efeito para buscar item por referência
  useMemo(() => {
      if (searchRef) {
          const index = siblingItems.findIndex(item => 
              item.numeroItem?.toLowerCase().includes(searchRef.toLowerCase()) || 
              item.item.toLowerCase().includes(searchRef.toLowerCase())
          );
          if (index !== -1) setActiveItemIndex(index);
      }
  }, [searchRef, siblingItems]);

  const currentItem = siblingItems[activeItemIndex];

  // Funções de navegação
  const goNext = () => setActiveItemIndex((prev) => Math.min(prev + 1, siblingItems.length - 1));
  const goPrev = () => setActiveItemIndex((prev) => Math.max(prev - 1, 0));

  // Touch Handlers
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) goNext();
    if (isRightSwipe) goPrev();
  };

  const handleStepClick = (orderId: string, step: ProductionStep, currentStatus: Status) => {
    if (!currentUser) return;
    const isOwner = currentUser.role === 'Admin' || currentUser.departamento === 'Geral' || currentUser.departamento === step;
    
    if (!isOwner) {
      alert(`ACESSO RESTRITO AO SETOR ${DEPARTMENTS[step] || step}`);
      return;
    }
    
    let next: Status;
    if (currentStatus === 'Em Produção') next = 'Concluído';
    else if (currentStatus === 'Concluído') next = 'Pendente';
    else next = 'Em Produção';
    
    onUpdateStatus(orderId, step, next);
  };

  const getLastStepUpdate = (item: Order, step: ProductionStep) => {
    if (!item.history || item.history.length === 0) return null;
    const stepHistory = item.history
        .filter(h => h.sector === step)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return stepHistory.length > 0 ? stepHistory[0] : null;
  };

  const handlePrint = () => {
    const htmlContent = generateTechnicalSheetHtml(order, allOrders || [order], companySettings);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.write('<script>window.onload = function() { window.print(); }</script>');
      printWindow.document.close();
    }
  };

  const handleDownloadHtml = () => {
    const htmlContent = generateTechnicalSheetHtml(order, allOrders || [order], companySettings);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FICHA_TECNICA_OR_${order.or}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopySummary = (item: Order) => {
      const summary = `O.R #${item.or}\nItem: ${item.item}\nCliente: ${item.cliente}\nEntrega: ${item.dataEntrega.split('-').reverse().join('/')}`;
      navigator.clipboard.writeText(summary);
      alert("Resumo copiado!");
  };

  return (
    <div className="fixed inset-0 z-[800] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
      <div className="bg-[#f8fafc] dark:bg-slate-900 w-full h-full md:max-w-4xl md:h-auto md:max-h-[90vh] md:rounded-[32px] shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header Visual Compacto */}
        <div className="bg-[#064e3b] dark:bg-emerald-950 px-4 py-4 md:p-6 md:pb-12 relative shrink-0 shadow-md z-10">
           <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 md:w-10 md:h-10 bg-white/10 rounded-xl flex items-center justify-center text-emerald-400 backdrop-blur-sm p-1">
                    <Logo src={companySettings.logoUrl} className="w-full h-full" />
                 </div>
                 <div>
                    <h2 className="text-white font-black uppercase text-xs md:text-sm tracking-widest leading-none">Ficha Técnica</h2>
                    <p className="text-emerald-400/60 text-[8px] md:text-[9px] font-bold uppercase tracking-[2px] mt-0.5">Produção Digital</p>
                 </div>
              </div>
              <button onClick={onClose} className="p-2 bg-black/20 text-white hover:bg-red-500/80 rounded-full transition-all backdrop-blur-sm active:scale-95">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg>
              </button>
           </div>
           
           <div className="mt-4 md:absolute md:-bottom-8 md:left-6 md:right-6 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between md:items-center gap-2 md:gap-0">
              <div className="flex justify-between md:block">
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">O.R Principal</span>
                 <span className="text-2xl md:text-3xl font-[950] text-slate-900 dark:text-white leading-none">#{order.or}</span>
              </div>
              <div className="flex justify-between md:flex-col md:items-end border-t md:border-t-0 border-slate-100 dark:border-slate-700 pt-2 md:pt-0">
                 <span className="text-[9px] font-bold text-slate-400 uppercase">Total de Itens</span>
                 <span className="text-lg md:text-xl font-black text-emerald-600 dark:text-emerald-400">{siblingItems.length}</span>
              </div>
           </div>
        </div>

        {/* Info Geral Sticky */}
        <div className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm z-10 px-4 pt-4 md:pt-12 pb-2 border-b border-slate-200 dark:border-slate-800 relative transition-all">
             
             {/* Botão de Recolher/Expandir Header (Mobile) - VISIBILIDADE MELHORADA */}
             <button 
                onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                className="md:hidden absolute top-2 right-2 p-2.5 text-slate-600 dark:text-slate-200 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-full shadow-sm border border-white/30 dark:border-white/10 hover:bg-emerald-500 hover:text-white transition-all z-20 active:scale-95"
                title={isHeaderCollapsed ? "Expandir Informações" : "Recolher Informações"}
             >
                <svg className={`w-5 h-5 transform transition-transform ${isHeaderCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M5 15l7-7 7 7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
             </button>

             {/* Input de Busca Rápida de Item */}
             {!isHeaderCollapsed && siblingItems.length > 1 && (
                 <div className="mb-3 flex items-center bg-white dark:bg-slate-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
                     <svg className="w-4 h-4 text-slate-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2"/></svg>
                     <input 
                        type="text" 
                        placeholder="Ir para Item/Ref..." 
                        value={searchRef}
                        onChange={(e) => setSearchRef(e.target.value)}
                        className="w-full bg-transparent text-[10px] font-bold uppercase outline-none dark:text-white placeholder:text-slate-400"
                     />
                 </div>
             )}

             {!isHeaderCollapsed && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2 animate-in fade-in slide-in-from-top-2">
                     <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cliente / Projeto</span>
                        <p className="text-sm md:text-base font-black text-slate-900 dark:text-white uppercase leading-tight line-clamp-1">{order.cliente}</p>
                     </div>
                     <div className="flex gap-3">
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex-1">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Vendedor</span>
                            <p className="text-xs md:text-sm font-black text-slate-900 dark:text-white uppercase truncate">{order.vendedor}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex-1">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Prioridade</span>
                            <p className={`text-xs md:text-sm font-black uppercase truncate ${order.prioridade === 'Alta' ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>{order.prioridade || 'Média'}</p>
                        </div>
                     </div>
                 </div>
             )}

             {/* Tab Navigation for Items */}
             <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                 {siblingItems.map((_, idx) => (
                     <button
                        key={idx}
                        onClick={() => setActiveItemIndex(idx)}
                        className={`
                            whitespace-nowrap px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border
                            ${idx === activeItemIndex 
                                ? 'bg-emerald-500 text-white border-emerald-600 shadow-md' 
                                : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}
                        `}
                     >
                        Item #{idx + 1}
                     </button>
                 ))}
             </div>
        </div>

        {/* Content Scrollable - Active Item Only */}
        <div 
            className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-slate-50 dark:bg-slate-900 pb-24 md:pb-6 relative"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
           
           {/* Setas de Navegação Flutuantes no Mobile */}
           <div className="absolute inset-y-0 left-0 flex items-center z-20 pointer-events-none px-2">
               {activeItemIndex > 0 && (
                   <button onClick={goPrev} className="pointer-events-auto p-3 bg-white/80 dark:bg-slate-800/80 shadow-lg rounded-full backdrop-blur-sm text-slate-500 dark:text-slate-300 hover:scale-110 transition-all border border-slate-200 dark:border-slate-700">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="3"/></svg>
                   </button>
               )}
           </div>
           <div className="absolute inset-y-0 right-0 flex items-center z-20 pointer-events-none px-2">
               {activeItemIndex < siblingItems.length - 1 && (
                   <button onClick={goNext} className="pointer-events-auto p-3 bg-white/80 dark:bg-slate-800/80 shadow-lg rounded-full backdrop-blur-sm text-slate-500 dark:text-slate-300 hover:scale-110 transition-all border border-slate-200 dark:border-slate-700">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="3"/></svg>
                   </button>
               )}
           </div>

           <div className="space-y-6 max-w-3xl mx-auto">
              {currentItem && (
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-[24px] border border-slate-100 dark:border-slate-700 shadow-md relative overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300" key={currentItem.id}>
                      {/* Item Header */}
                      <div className="flex justify-between items-start mb-3 border-b border-slate-50 dark:border-slate-700 pb-3">
                          <div className="flex items-center gap-2">
                              <span className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black px-3 py-1 rounded-lg">ITEM #{activeItemIndex + 1}</span>
                              {currentItem.numeroItem && (
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">REF: {currentItem.numeroItem}</span>
                              )}
                          </div>
                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${currentItem.isArchived ? 'bg-slate-100 text-slate-400' : 'bg-emerald-100 text-emerald-600'}`}>
                              {currentItem.isArchived ? 'Arquivado' : 'Ativo'}
                          </span>
                      </div>

                      {/* Descrição Grande */}
                      <p className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-200 uppercase leading-relaxed mb-4">
                          {currentItem.item}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-emerald-500/20 shadow-sm flex flex-col justify-center">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Previsão Entrega</span>
                              <span className="text-xl md:text-2xl font-[950] text-slate-800 dark:text-white tracking-tight leading-none">
                                  {currentItem.dataEntrega.split('-').reverse().join('/')}
                              </span>
                              <div className="w-full h-px bg-slate-200 dark:bg-slate-700 my-2"></div>
                              <span className="text-[9px] font-medium text-slate-400">
                                  Criado: {currentItem.createdAt ? new Date(currentItem.createdAt).toLocaleDateString('pt-BR') : '-'}
                              </span>
                          </div>
                          
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center items-center">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Quantidade</span>
                              <span className="text-2xl md:text-3xl font-[950] text-slate-800 dark:text-white tracking-tight leading-none">
                                  {currentItem.quantidade || '1'}
                              </span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">Unidade(s)</span>
                          </div>
                      </div>

                      {currentItem.observacao && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl mb-4 border border-amber-100 dark:border-amber-800/50">
                              <span className="text-[8px] text-amber-600 dark:text-amber-400 font-black uppercase block mb-1">Observação</span>
                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 italic block leading-relaxed">{currentItem.observacao}</span>
                          </div>
                      )}

                      {/* Status Grid Interativo */}
                      <div className="mb-4">
                          <span className="text-[8px] text-slate-400 font-black uppercase block mb-2">Controle de Status (Toque para alterar)</span>
                          <div className="grid grid-cols-2 gap-2">
                              {['preImpressao', 'impressao', 'producao', 'instalacao', 'expedicao'].map(step => {
                                  const prodStep = step as ProductionStep;
                                  const status = currentItem[prodStep];
                                  const isDone = status === 'Concluído';
                                  const isProgress = status === 'Em Produção';
                                  const lastUpdate = getLastStepUpdate(currentItem, prodStep);
                                  
                                  return (
                                      <div key={step} className="flex flex-col">
                                          <button 
                                              onClick={() => handleStepClick(currentItem.id, prodStep, status)}
                                              className={`
                                                  px-3 py-3 rounded-xl border flex items-center justify-between transition-all active:scale-95 shadow-sm
                                                  ${isDone ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                                                    isProgress ? 'bg-amber-50 border-amber-200 text-amber-700' : 
                                                    'bg-white border-slate-100 text-slate-300 dark:bg-slate-800 dark:border-slate-700'}
                                              `}
                                          >
                                              <span className="text-[9px] font-black uppercase">{DEPARTMENTS[prodStep].split(' ')[0]}</span>
                                              <div className={`w-3 h-3 rounded-full ${isDone ? 'bg-emerald-500' : isProgress ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-600'}`}></div>
                                          </button>
                                          {/* Last Update Info Display */}
                                          {lastUpdate && (
                                              <div className="text-[7px] text-slate-400 font-bold text-right pr-1 mt-1 uppercase">
                                                  {lastUpdate.userName.split(' ')[0]} • {new Date(lastUpdate.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                              </div>
                                          )}
                                      </div>
                                  )
                              })}
                          </div>
                      </div>

                      {/* Botões de Ação Rápida no Card */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                          <button onClick={() => onEdit()} className="flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 active:scale-95 transition-all">
                              <svg className="w-5 h-5 text-slate-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2"/></svg>
                              <span className="text-[8px] font-black uppercase text-slate-500">Editar</span>
                          </button>
                          <button onClick={() => onShowQR(currentItem)} className="flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 active:scale-95 transition-all">
                              <svg className="w-5 h-5 text-purple-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v1m6 11h2m-6 0h-2v4h2v-4zM6 8v4h4V8H6zm14 10.5c0 .276-.224.5-.5.5h-3a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v3z" strokeWidth="2"/></svg>
                              <span className="text-[8px] font-black uppercase text-slate-500">QR Code</span>
                          </button>
                          <button onClick={() => handleCopySummary(currentItem)} className="flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 active:scale-95 transition-all">
                              <svg className="w-5 h-5 text-blue-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" strokeWidth="2"/></svg>
                              <span className="text-[8px] font-black uppercase text-slate-500">Copiar</span>
                          </button>
                      </div>
                  </div>
              )}
           </div>
        </div>

        {/* Footer Actions Fixed Bottom */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 z-20 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
           {/* MOBILE FOOTER LAYOUT */}
           <div className="flex gap-2 md:hidden">
                <button 
                  onClick={handlePrint}
                  className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                  title="Imprimir"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeWidth="2.5"/></svg>
                </button>
                <button 
                  onClick={handleDownloadHtml}
                  className="p-4 bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all active:scale-95"
                  title="Baixar HTML"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2.5"/></svg>
                </button>
                <button 
                  onClick={() => { onClose(); onEdit(); }}
                  className="flex-1 py-4 bg-[#064e3b] dark:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-emerald-900 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2.5"/></svg>
                  Editar
                </button>
           </div>

           {/* DESKTOP FOOTER LAYOUT (Visual inside Modal) */}
           <div className="hidden md:flex gap-3">
               <div className="flex gap-2 w-full">
                   <button 
                      onClick={handlePrint}
                      className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                   >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeWidth="2.5"/></svg>
                      Imprimir
                   </button>
                   <button 
                      onClick={handleDownloadHtml}
                      className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                   >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2.5"/></svg>
                      Baixar HTML
                   </button>
               </div>
               <button 
                  onClick={() => { onClose(); onEdit(); }}
                  className="w-full md:w-auto md:flex-[2] py-4 bg-[#064e3b] dark:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-emerald-900 transition-all active:scale-95 flex items-center justify-center gap-2"
               >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2.5"/></svg>
                  Editar O.R Completa
               </button>
           </div>
        </div>

      </div>
    </div>
  );
};

export default TechnicalSheetModal;
