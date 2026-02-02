
import React, { useState, useMemo } from 'react';
import { Order, ProductionStep, Status, DEPARTMENTS, User } from '../types';

interface KanbanViewProps {
  orders: Order[];
  onUpdateStatus: (id: string, field: ProductionStep, next: Status) => void;
  onEditOrder: (order: Order) => void;
  currentUser: User | null;
  onShowQR: (order: Order) => void;
  onShowAttachment: (order: Order) => void;
}

const KanbanView: React.FC<KanbanViewProps> = ({ 
    orders, 
    onUpdateStatus, 
    onEditOrder, 
    currentUser,
    onShowQR,
    onShowAttachment
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  const [focusedColumnId, setFocusedColumnId] = useState<string | 'all'>('all');

  // Define active sector based on current user for "Focus Mode"
  const activeSector = useMemo(() => {
      if (!currentUser || currentUser.role === 'Admin' || currentUser.departamento === 'Geral') return null;
      return currentUser.departamento;
  }, [currentUser]);

  // Definição das colunas
  const columns: { id: string; label: string; step?: ProductionStep }[] = [
    { id: 'design', label: '1. Design', step: 'preImpressao' },
    { id: 'print', label: '2. Impressão', step: 'impressao' },
    { id: 'prod', label: '3. Acabamento', step: 'producao' },
    { id: 'install', label: '4. Instalação', step: 'instalacao' },
    { id: 'shipping', label: '5. Expedição', step: 'expedicao' },
    { id: 'done', label: 'Finalizado', step: undefined }
  ];

  // Helper para verificar permissão
  const canEdit = (step?: ProductionStep) => {
      if (!currentUser || !step) return false;
      return currentUser.role === 'Admin' || currentUser.departamento === 'Geral' || currentUser.departamento === step;
  };

  const getOrderStage = (order: Order): string => {
    if (order.isArchived) return 'done';
    if (order.preImpressao !== 'Concluído') return 'design';
    if (order.impressao !== 'Concluído') return 'print';
    if (order.producao !== 'Concluído') return 'prod';
    if (order.instalacao !== 'Concluído') return 'install';
    if (order.expedicao !== 'Concluído') return 'shipping';
    return 'done';
  };

  // Agrupamento Inteligente: Agrupa por Coluna E por O.R.
  const groupedData = useMemo(() => {
    const data: Record<string, { or: string; client: string; items: Order[] }[]> = {};
    columns.forEach(col => data[col.id] = []);

    // 1. Filtrar
    const filtered = orders.filter(o => 
        o.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.or.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.item.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 2. Agrupar temporariamente
    const tempGroup: Record<string, Record<string, Order[]>> = {}; // { columnId: { orNumber: [orders] } }

    filtered.forEach(order => {
        if (order.isArchived && order.expedicao === 'Concluído') return; // Ocultar arquivados antigos por padrão
        
        const stage = getOrderStage(order);
        if (!tempGroup[stage]) tempGroup[stage] = {};
        if (!tempGroup[stage][order.or]) tempGroup[stage][order.or] = [];
        tempGroup[stage][order.or].push(order);
    });

    // 3. Transformar em array ordenado para renderização
    Object.keys(tempGroup).forEach(colId => {
        const orKeys = Object.keys(tempGroup[colId]);
        orKeys.forEach(or => {
            const items = tempGroup[colId][or];
            // Ordenar itens por ref
            items.sort((a,b) => (a.numeroItem || '').localeCompare(b.numeroItem || ''));
            
            data[colId].push({
                or,
                client: items[0].cliente,
                items
            });
        });
        // Ordenar os grupos dentro da coluna (Prioridade > Data)
        data[colId].sort((a, b) => {
            const itemA = a.items[0];
            const itemB = b.items[0];
            if (itemA.prioridade === 'Alta' && itemB.prioridade !== 'Alta') return -1;
            if (itemA.prioridade !== 'Alta' && itemB.prioridade === 'Alta') return 1;
            return itemA.dataEntrega.localeCompare(itemB.dataEntrega);
        });
    });

    return data;
  }, [orders, searchTerm]);

  // Nova Lógica de Processo: Receber (Pendente -> Em Produção) -> Avançar (Em Produção -> Concluído)
  const handleProcessStep = (e: React.MouseEvent, order: Order, step?: ProductionStep) => {
      e.stopPropagation();
      if (!step) return;
      
      // Validação Extra de Segurança
      if (!canEdit(step)) {
          alert("Acesso Negado: Você não pode mover itens deste setor.");
          return;
      }

      const currentStatus = order[step];
      
      if (currentStatus === 'Pendente') {
          // Receber a ordem (Iniciar)
          onUpdateStatus(order.id, step, 'Em Produção');
      } else if (currentStatus === 'Em Produção') {
          // Finalizar e Avançar
          onUpdateStatus(order.id, step, 'Concluído');
      }
  };

  const toggleDetails = (itemId: string) => {
      setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const toggleColumnCollapse = (colId: string) => {
      setCollapsedColumns(prev => ({ ...prev, [colId]: !prev[colId] }));
  };

  // --- VIEW CONTROLS ---
  const handleExpandAll = () => {
      setCollapsedColumns({});
      setFocusedColumnId('all');
  };
  
  const handleCollapseAll = () => {
      const allCollapsed = columns.reduce((acc, col) => ({...acc, [col.id]: true}), {});
      setCollapsedColumns(allCollapsed);
      setFocusedColumnId('all');
  };

  const handleFocusColumn = (targetId: string) => {
      setFocusedColumnId(targetId);
      if (targetId === 'all') {
          setCollapsedColumns({});
          return;
      }
      const focusState = columns.reduce((acc, col) => ({
          ...acc,
          [col.id]: col.id !== targetId
      }), {});
      setCollapsedColumns(focusState);
  };

  const stepsList: ProductionStep[] = ['preImpressao', 'impressao', 'producao', 'instalacao', 'expedicao'];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 relative overflow-hidden">
      {/* Top Bar: Search & View Controls */}
      <div className="shrink-0 px-4 py-3 flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10 shadow-sm">
          
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
              {/* Search */}
              <div className="relative w-full md:w-64">
                  <input 
                      type="text" 
                      placeholder="Filtrar O.R, Cliente..." 
                      className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 ring-emerald-500 transition-all dark:text-white"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5"/></svg>
              </div>

              {/* Quick Visibility Controls */}
              <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                  <button 
                    onClick={handleExpandAll} 
                    className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-all shadow-sm hover:shadow" 
                    title="Expandir Tudo"
                  >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" strokeWidth="2"/></svg>
                  </button>
                  <button 
                    onClick={handleCollapseAll} 
                    className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-all shadow-sm hover:shadow" 
                    title="Recolher Tudo"
                  >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v16h16V4H4z" strokeWidth="2"/><path d="M9 9l6 6m0-6l-6 6" strokeWidth="2"/></svg>
                  </button>
              </div>

              {/* Enhanced Focus Selector Button */}
              <div className="relative group">
                  <div className={`
                      flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer border
                      ${focusedColumnId !== 'all' 
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 shadow-md shadow-amber-500/10' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'}
                  `}>
                      {focusedColumnId !== 'all' && <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>}
                      <span>
                          {focusedColumnId === 'all' ? '👁️ Focar Setor' : columns.find(c => c.id === focusedColumnId)?.label}
                      </span>
                      <svg className="w-3 h-3 ml-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      
                      {/* Invisible Select overlay for functionality */}
                      <select 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          value={focusedColumnId}
                          onChange={(e) => handleFocusColumn(e.target.value)}
                      >
                          <option value="all">Visão Geral (Todos)</option>
                          {columns.map(col => (
                              <option key={col.id} value={col.id}>{col.label}</option>
                          ))}
                      </select>
                  </div>
              </div>
              
              {focusedColumnId !== 'all' && (
                  <button 
                      onClick={() => handleFocusColumn('all')}
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                      title="Limpar Filtro"
                  >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
              )}
          </div>
          
          <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Seu Setor</span>
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2.5"/></svg>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Bloqueado</span>
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Prioridade</span>
              </div>
          </div>
      </div>

      {/* Kanban Board Container - Maximize Height */}
      <div className="flex-1 flex overflow-x-auto overflow-y-hidden px-2 pt-2 md:px-4 md:pt-4 pb-0 gap-3 md:gap-4 custom-scrollbar items-stretch bg-slate-50/50 dark:bg-slate-900/50">
        {columns.map((col) => {
            // Lógica de Permissão
            const isMySector = activeSector === col.step;
            const userIsAdmin = currentUser?.role === 'Admin' || currentUser?.departamento === 'Geral';
            const isLocked = !isMySector && !userIsAdmin && col.id !== 'done';
            
            // Lógica de Colapso
            const isCollapsed = collapsedColumns[col.id];
            
            // Lógica de Largura
            let widthClass = 'min-w-[340px] w-[380px] flex-shrink-0'; // Padrão
            if (isCollapsed) {
                widthClass = 'w-14 min-w-[3.5rem] flex-shrink-0'; // Colapsado
            } else if (isLocked) {
                widthClass = 'min-w-[260px] w-[260px] flex-shrink-0'; // Bloqueado
            }

            const groups = groupedData[col.id];
            
            // Estilo de Fundo (Ajuste para encostar na base: rounded-b-none, border-b-0, mb-0)
            let bgClass = 'bg-slate-100/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800';
            if (isMySector) bgClass = 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800';
            if (isLocked) bgClass = 'bg-slate-50/50 dark:bg-black/20 border-slate-200 dark:border-slate-800 opacity-90';

            return (
                <div key={col.id} className={`${widthClass} flex flex-col h-full rounded-t-2xl rounded-b-none border-x border-t border-b-0 mb-0 ${bgClass} transition-all duration-300 relative`}>
                    
                    {/* Column Header */}
                    <div 
                        className={`
                            p-3 border-b border-inherit flex justify-between items-center rounded-t-2xl transition-all shrink-0
                            ${isMySector ? 'bg-emerald-100/50 dark:bg-emerald-900/30' : ''}
                            ${isCollapsed ? 'h-full flex-col py-4 justify-between bg-slate-200/50 dark:bg-slate-800/80 items-center' : ''}
                        `}
                    >
                        {isCollapsed ? (
                            // Header Vertical (Colapsado)
                            <>
                                <button 
                                    onClick={() => toggleColumnCollapse(col.id)}
                                    className="p-2 rounded-full hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-emerald-500 transition-colors shadow-sm bg-white/50 dark:bg-black/20"
                                    title="Expandir"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 5l7 7-7 7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                                
                                <div className="flex-1 flex items-center justify-center min-h-0 py-4">
                                    <span className="[writing-mode:vertical-rl] rotate-180 text-xs font-black uppercase tracking-[3px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                        {col.label}
                                        {isLocked && <span className="ml-2 opacity-50">🔒</span>}
                                    </span>
                                </div>

                                <div className="bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[9px] font-black w-7 h-7 rounded-full flex items-center justify-center shadow-inner">
                                    {groups.length}
                                </div>
                            </>
                        ) : (
                            // Header Horizontal (Expandido)
                            <>
                                <div className="flex items-center gap-2">
                                    {isLocked ? (
                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2.5"/></svg>
                                    ) : (
                                        <div className={`w-2.5 h-2.5 rounded-full ${isMySector ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                    )}
                                    <span className={`text-xs font-black uppercase tracking-wider ${isMySector ? 'text-emerald-800 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                        {col.label}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded text-[10px] font-black shadow-sm">{groups.length}</span>
                                    
                                    {!isMySector && (
                                        <button 
                                            onClick={() => toggleColumnCollapse(col.id)}
                                            className="p-1 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                            title="Recolher Coluna"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Cards Container */}
                    {!isCollapsed && (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3 pb-4">
                            {groups.map((group) => {
                                const firstItem = group.items[0];
                                const isHighPriority = group.items.some(i => i.prioridade === 'Alta');
                                
                                return (
                                    <div key={group.or} className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col group/card hover:shadow-md transition-all relative overflow-hidden ${isHighPriority ? 'border-l-4 border-l-red-500' : ''}`}>
                                        
                                        {/* Card Header (Unified OR) */}
                                        <div className="p-3 pb-2 border-b border-slate-50 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-800/50">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className={`text-sm font-[950] ${isHighPriority ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`}>#{group.or}</span>
                                                    {isHighPriority && <span className="bg-red-100 text-red-600 text-[8px] font-black px-1.5 rounded uppercase">Urgente</span>}
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase truncate" title={group.client}>
                                                    {group.client}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-[9px] font-black block text-slate-500 dark:text-slate-400">{firstItem.dataEntrega.split('-').reverse().join('/')}</span>
                                                <span className="text-[8px] font-bold text-slate-400 uppercase">Entrega</span>
                                            </div>
                                        </div>

                                        {/* Items List */}
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {group.items.map((item, idx) => {
                                                const isExpanded = expandedItems[item.id];
                                                const hasAttachment = item.attachments && item.attachments.length > 0;
                                                
                                                // Status Logic
                                                const currentStatus = col.step ? item[col.step] : 'Concluído';
                                                const isPending = currentStatus === 'Pendente';
                                                const isInProgress = currentStatus === 'Em Produção';
                                                const isDone = currentStatus === 'Concluído';

                                                // Action Button Config
                                                let actionIcon = null;
                                                let actionClass = "";
                                                let actionTitle = "";

                                                if (isLocked) {
                                                    actionIcon = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2.5"/></svg>;
                                                    actionClass = "bg-slate-50 text-slate-300 cursor-not-allowed border-slate-100 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700";
                                                    actionTitle = "Apenas setor responsável pode alterar";
                                                } else if (isPending) {
                                                    actionIcon = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" strokeWidth="2.5"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2"/></svg>;
                                                    actionClass = "bg-slate-100 text-slate-500 hover:bg-blue-500 hover:text-white";
                                                    actionTitle = "Receber / Iniciar";
                                                } else if (isInProgress) {
                                                    actionIcon = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3"/></svg>;
                                                    actionClass = "bg-amber-100 text-amber-600 hover:bg-emerald-500 hover:text-white animate-pulse";
                                                    actionTitle = "Concluir e Avançar";
                                                }

                                                return (
                                                    <div key={item.id} className={`group/item transition-colors ${isInProgress ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                                                        {/* Item Header Row */}
                                                        <div className="flex items-center gap-2 p-2">
                                                            <button 
                                                                onClick={() => toggleDetails(item.id)}
                                                                className={`p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all ${isExpanded ? 'rotate-180 text-emerald-500' : ''}`}
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                            </button>

                                                            <div className="flex-1 min-w-0 flex flex-col">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[9px] font-black text-slate-300">#{String(idx + 1).padStart(2,'0')}</span>
                                                                    {item.numeroItem && <span className="text-[8px] font-bold bg-slate-100 dark:bg-slate-700 px-1 rounded text-slate-500">REF {item.numeroItem}</span>}
                                                                    <span className="text-[8px] font-bold text-slate-400 uppercase">{item.quantidade}un</span>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase truncate leading-tight cursor-pointer" onClick={() => toggleDetails(item.id)} title={item.item}>
                                                                    {item.item}
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Action Button */}
                                                            {col.id !== 'done' && !isDone && (
                                                                <button 
                                                                    onClick={(e) => !isLocked && handleProcessStep(e, item, col.step)}
                                                                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95 shrink-0 border border-transparent ${actionClass}`}
                                                                    title={actionTitle}
                                                                    disabled={isLocked}
                                                                >
                                                                    {actionIcon}
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Expanded Details */}
                                                        {isExpanded && (
                                                            <div className="px-3 pb-3 pt-1">
                                                                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[9px] space-y-2 border border-slate-100 dark:border-slate-700">
                                                                    <div>
                                                                        <span className="font-black text-slate-400 uppercase block mb-0.5">Descrição Completa</span>
                                                                        <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed uppercase">{item.item}</p>
                                                                    </div>
                                                                    {item.observacao && (
                                                                        <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-100 dark:border-amber-800">
                                                                            <span className="font-black text-amber-600 dark:text-amber-400 uppercase block mb-0.5">Observação</span>
                                                                            <p className="text-slate-700 dark:text-slate-300 italic">{item.observacao}</p>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-between items-end pt-1 border-t border-slate-200 dark:border-slate-700 mt-2">
                                                                        <div className="text-[8px] text-slate-400">
                                                                            Vendedor: <span className="font-bold text-slate-600 dark:text-slate-300">{item.vendedor}</span>
                                                                        </div>
                                                                        {item.isRemake && <span className="text-[8px] font-black text-orange-500 bg-orange-100 px-1 rounded uppercase">Refazimento</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Footer Tools */}
                                                        <div className="px-2 py-1.5 flex justify-between items-center gap-2 border-t border-slate-50 dark:border-slate-800">
                                                            <div className="flex items-center gap-0.5">
                                                                {stepsList.map(s => {
                                                                    const sStatus = item[s];
                                                                    const sDone = sStatus === 'Concluído';
                                                                    const sActive = sStatus === 'Em Produção';
                                                                    return <div key={s} className={`w-1.5 h-1.5 rounded-full ${sDone ? 'bg-emerald-400' : sActive ? 'bg-amber-400 animate-pulse' : 'bg-slate-200 dark:bg-slate-700'}`} title={s}></div>
                                                                })}
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <button onClick={() => onShowAttachment(item)} className={`p-1.5 rounded-md transition-colors flex items-center gap-1 ${hasAttachment ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-blue-500'}`}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" strokeWidth="2"/></svg>{hasAttachment && <span className="text-[8px] font-black">{item.attachments?.length}</span>}</button>
                                                                <button onClick={() => onShowQR(item)} className="p-1.5 text-slate-400 hover:text-purple-500 rounded-md"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v1m6 11h2m-6 0h-2v4h2v-4zM6 8v4h4V8H6zm14 10.5c0 .276-.224.5-.5.5h-3a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v3z" strokeWidth="2"/></svg></button>
                                                                <button onClick={() => onEditOrder(item)} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth="2"/></svg></button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                            {groups.length === 0 && (
                                <div className="h-32 flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                    <span className="text-[10px] font-black uppercase">Vazio</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        })}
      </div>
      
      {/* Legend Footer - Updated margin to ensure columns sit flush */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-center gap-6 md:gap-10 shrink-0 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-20">
          <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full"></div>
              <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Concluído</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-amber-400 rounded-full"></div>
              <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Em Produção</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
              <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Pendente</span>
          </div>
          <div className="hidden md:flex items-center gap-2 pl-6 border-l border-slate-200 dark:border-slate-700">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Expandir Detalhes</span>
          </div>
      </div>
    </div>
  );
};

export default KanbanView;
