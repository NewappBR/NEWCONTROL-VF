
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Order, Status, User, ProductionStep, SortConfig, Notification, HistoryEntry, CompanySettings, GlobalLogEntry, Ramal, DEPARTMENTS } from './types';
import ProductionTable from './components/ProductionTable';
import Login from './components/Login';
import QRCodeModal from './components/QRCodeModal';
import OrderModal from './components/OrderModal';
import NotificationPanel from './components/NotificationPanel';
import UserManagementModal from './components/UserManagementModal';
import OrderHistoryModal from './components/OrderHistoryModal';
import CalendarView from './components/CalendarView';
import OperatorPanel from './components/OperatorPanel';
import CreateAlertModal from './components/CreateAlertModal';
import QRScannerModal from './components/QRScannerModal';
import TechnicalSheetModal from './components/TechnicalSheetModal';
import { MOCK_USERS, DEFAULT_USER_PASS } from './constants';
import { 
  loadFullData, 
  apiCreateOrder, 
  apiUpdateOrder, 
  apiDeleteOrder, 
  saveGlobalData, 
  subscribeToChanges 
} from './services/storageService';
import { generateTechnicalSheetHtml } from './utils/printHelpers';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('offline');
  
  const mainRef = useRef<HTMLDivElement>(null);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ramais, setRamais] = useState<Ramal[]>([]);
  const [globalLogs, setGlobalLogs] = useState<GlobalLogEntry[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
      name: 'NEWCOM CONTROL',
      address: 'Rua da Produção, 123',
      contact: 'Tel: (00) 0000-0000',
      reminderEnabled: false
  });

  // --- CARREGAMENTO DE DADOS (Híbrido) ---
  const fetchData = async () => {
      setIsSyncing(true);
      const data = await loadFullData(); // Agora retorna dados mesmo se falhar (fallback local)
      
      if (data) {
          // Define status baseado na resposta do service
          setConnectionStatus(data.isOffline ? 'offline' : 'online');

          if (data.orders) setOrders(data.orders);
          if (data.users && data.users.length > 0) setUsers(data.users);
          
          // Se settings vier vazio do backend/local, mantém o default ou anterior
          if (data.settings && Object.keys(data.settings).length > 0) {
              setCompanySettings(data.settings);
          }
          if (data.logs) setGlobalLogs(data.logs);
      }
      
      setIsDataLoaded(true);
      setTimeout(() => setIsSyncing(false), 500);
  };

  useEffect(() => {
    fetchData(); // Carga inicial

    // Inicia conexão Real-Time (Socket.io)
    subscribeToChanges(() => {
        // Se receber um sinal do socket, atualiza
        fetchData(); 
    });
  }, []);

  const [activeTab, setActiveTab] = useState<'OPERACIONAL' | 'CONCLUÍDAS' | 'CALENDÁRIO'>('OPERACIONAL');
  const [dashboardFilter, setDashboardFilter] = useState<'TODAS' | 'PRODUCAO' | 'ATRASADAS'>('TODAS');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showQRModal, setShowQRModal] = useState<Order | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showOperatorPanel, setShowOperatorPanel] = useState(false);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showTechSheetModal, setShowTechSheetModal] = useState<Order | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'dataEntrega', direction: 'asc' });

  const [manualNotifications, setManualNotifications] = useState<Notification[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<Notification[]>([]);

  const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' | 'info' }>({ 
    show: false, message: '', type: 'info' 
  });

  const formatHeaderTime = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    };
    return date.toLocaleString('pt-BR', options).toUpperCase().replace(/\.|,/g, '');
  };

  const handleScrollToTop = () => {
    if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (isDarkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); } 
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDarkMode]);

  useEffect(() => {
    const timer = setInterval(() => { setCurrentTime(new Date()); checkAutomatedNotifications(); }, 60000); 
    checkAutomatedNotifications();
    return () => clearInterval(timer);
  }, [orders, currentUser]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Persistência Híbrida
  const handleUpdateUsers = (newUsers: User[]) => {
      setUsers(newUsers);
      saveGlobalData(newUsers, undefined, undefined);
  };
  const handleUpdateSettings = (newSettings: CompanySettings) => {
      setCompanySettings(newSettings);
      saveGlobalData(undefined, newSettings, undefined);
  };
  const handleUpdateLogs = (newLogs: GlobalLogEntry[]) => {
      setGlobalLogs(newLogs);
      saveGlobalData(undefined, undefined, newLogs);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  const addNotification = (title: string, message: string, type: 'urgent' | 'warning' | 'info' | 'success', targetId: string = 'ALL', sector?: string) => {
    const newNotif: Notification = {
      id: Date.now().toString() + Math.random().toString(),
      title, message, type, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      readBy: [], targetUserId: targetId, targetSector: sector || 'Geral'
    };
    setSystemNotifications(prev => {
        const isDuplicate = prev.some(n => n.title === title && n.message === message && n.targetUserId === targetId);
        if (isDuplicate) return prev;
        return [newNotif, ...prev].slice(0, 50);
    });
  };

  const checkAutomatedNotifications = () => {
    if (!currentUser) return;
    const todayStr = new Date().toLocaleDateString('en-CA');
    const newAlerts: Notification[] = [];
    orders.forEach(o => {
      if (o.isArchived) return;
      if (o.dataEntrega === todayStr) {
        newAlerts.push({ id: `today-${o.id}-${todayStr}`, title: '📅 ATENÇÃO: PRAZO HOJE', message: `O.R #${o.or} vence hoje. Prioridade máxima.`, type: 'warning', timestamp: new Date().toLocaleTimeString(), readBy: [], targetUserId: 'ALL', targetSector: 'Geral', referenceDate: o.dataEntrega });
      }
      if (o.dataEntrega < todayStr) {
        newAlerts.push({ id: `delay-${o.id}-${todayStr}`, title: '🚨 URGENTE: ATRASADO', message: `O.R #${o.or} está atrasada!`, type: 'urgent', timestamp: new Date().toLocaleTimeString(), readBy: [], targetUserId: 'ALL', targetSector: 'Geral', referenceDate: o.dataEntrega });
      }
    });
    setSystemNotifications(prev => {
        const currentIds = new Set(prev.map(n => n.id));
        const uniqueNewAlerts = newAlerts.filter(a => !currentIds.has(a.id));
        if (uniqueNewAlerts.length === 0) return prev;
        return [...uniqueNewAlerts, ...prev].slice(0, 50);
    });
  };

  const notifications = useMemo(() => {
    if (!currentUser) return [];
    const allNotifs = [...manualNotifications, ...systemNotifications];
    const visibleNotifs = allNotifs.filter(n => {
       const isForUser = n.targetUserId === 'ALL' || n.targetUserId === currentUser.id;
       if (!isForUser || n.readBy.includes(currentUser.id)) return false;
       return true;
    });
    const typePriority = { urgent: 3, warning: 2, success: 1, info: 0 };
    return visibleNotifs.sort((a, b) => typePriority[b.type] - typePriority[a.type]);
  }, [manualNotifications, systemNotifications, currentUser]);

  const handleCreateAlert = (targetUserId: string, title: string, message: string, type: Notification['type'], date?: string) => {
    const newAlert: Notification = { 
        id: `manual-${Date.now()}`, title: title.toUpperCase(), message, type, timestamp: new Date().toLocaleTimeString(), readBy: [], targetUserId, senderName: currentUser?.nome, referenceDate: date, targetSector: 'Geral' 
    };
    setManualNotifications(prev => [newAlert, ...prev]);
    showToast('Alerta enviado!', 'success');
  };

  const handleMarkAsRead = (id: string) => {
    if (!currentUser) return;
    const updateReadBy = (n: Notification) => n.id === id && !n.readBy.includes(currentUser.id) ? { ...n, readBy: [...n.readBy, currentUser.id] } : n;
    setManualNotifications(prev => prev.map(updateReadBy)); 
    setSystemNotifications(prev => prev.map(updateReadBy));
  };

  const handleMarkAllRead = () => {
    if (!currentUser) return;
    const updateAll = (n: Notification) => (n.targetUserId === 'ALL' || n.targetUserId === currentUser.id) && !n.readBy.includes(currentUser.id) ? { ...n, readBy: [...n.readBy, currentUser.id] } : n;
    setManualNotifications(prev => prev.map(updateAll)); 
    setSystemNotifications(prev => prev.map(updateAll));
  };

  const handleNotificationAction = (notification: Notification) => { 
      if (notification.metadata && notification.metadata.type === 'RESET_PASSWORD') {
          const targetLogin = String(notification.metadata.targetUserLogin || '').trim();
          const targetUser = users.find(u => u.email.toLowerCase().includes(targetLogin.toLowerCase()) || u.nome.toLowerCase().includes(targetLogin.toLowerCase()));
          if (targetUser) {
              handleUpdateUsers(users.map(user => user.id === targetUser.id ? { ...user, password: '1234' } : user));
              handleMarkAsRead(notification.id);
              showToast(`Senha de "${targetUser.nome}" resetada para 1234`, 'success');
          } else { showToast(`Erro: Usuário não encontrado.`, 'error'); }
      }
  };

  const handleScanSuccess = (decodedText: string) => {
    setShowScanner(false);
    const orMatch = decodedText.match(/#(\w+)/);
    const orNumber = orMatch ? orMatch[1] : null;
    const foundOrder = orders.find(o => o.or === orNumber || decodedText.includes(o.or) || decodedText.includes(o.id));
    if (foundOrder) { setShowTechSheetModal(foundOrder); showToast(`O.R #${foundOrder.or} carregada!`, 'success'); } 
    else { showToast('O.R não encontrada no sistema.', 'error'); }
  };

  const handlePrintTechSheet = (order: Order) => setShowTechSheetModal(order);
  
  const handleDirectPrint = (order: Order) => {
    const html = generateTechnicalSheetHtml(order, orders, companySettings);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.write('<script>window.onload = function() { window.print(); }</script>');
      printWindow.document.close();
    }
  };

  const handleCalendarDateClick = (dateStr: string) => {
      setSearchTerm(dateStr.split('-').reverse().join('/'));
      setActiveTab('OPERACIONAL');
      setDashboardFilter('TODAS');
      showToast(`Filtrando por: ${dateStr.split('-').reverse().join('/')}`, 'info');
  };

  const stats = useMemo(() => {
    const active = orders.filter(o => !o.isArchived);
    const today = new Date().toISOString().split('T')[0];
    return {
      total: active.length,
      emAndamento: active.filter(o => ['preImpressao', 'impressao', 'producao', 'instalacao', 'expedicao'].includes(o.preImpressao) && o.preImpressao === 'Em Produção').length, 
      atrasadas: active.filter(o => o.dataEntrega < today).length
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => {
      const term = debouncedSearch.toLowerCase();
      const dateFormatted = o.dataEntrega.split('-').reverse().join('/');
      const matchesSearch = o.cliente.toLowerCase().includes(term) || o.or.toLowerCase().includes(term) || o.vendedor.toLowerCase().includes(term) || o.item.toLowerCase().includes(term) || (o.numeroItem && o.numeroItem.toLowerCase().includes(term)) || dateFormatted.includes(term);
      if (activeTab === 'CALENDÁRIO') return matchesSearch;
      return (activeTab === 'OPERACIONAL' ? !o.isArchived : o.isArchived) && matchesSearch;
    });
    if (activeTab === 'OPERACIONAL' && dashboardFilter !== 'TODAS') {
      if (dashboardFilter === 'PRODUCAO') result = result.filter(o => o.preImpressao === 'Em Produção' || o.impressao === 'Em Produção' || o.producao === 'Em Produção' || o.instalacao === 'Em Produção' || o.expedicao === 'Em Produção');
      else if (dashboardFilter === 'ATRASADAS') result = result.filter(o => o.dataEntrega < new Date().toISOString().split('T')[0]);
    }
    return result;
  }, [orders, activeTab, debouncedSearch, dashboardFilter]);

  // --- ACTIONS (Atualizam localmente + API em background) ---

  const handleUpdateStatus = async (id: string, step: ProductionStep, next: Status) => {
    // 1. Atualização Otimista no Estado React
    const orderIndex = orders.findIndex(o => o.id === id);
    if (orderIndex === -1) return;
    
    const order = orders[orderIndex];
    const newEntry: HistoryEntry = { userId: currentUser?.id || 'sys', userName: currentUser?.nome || 'Sistema', timestamp: new Date().toISOString(), status: next, sector: step };
    const updatedOrder = { ...order, [step]: next, history: [...(order.history || []), newEntry] };
    
    if (step === 'expedicao' && next === 'Concluído') { 
        updatedOrder.isArchived = true; 
        updatedOrder.archivedAt = new Date().toISOString(); 
        showToast('FINALIZADO E ARQUIVADO', 'success'); 
    }

    // Atualiza UI
    const newOrders = [...orders];
    newOrders[orderIndex] = updatedOrder;
    setOrders(newOrders);

    // 2. Chama Service (que lida com LocalStorage/API)
    await apiUpdateOrder(updatedOrder);
  };

  const handleArchiveOrder = async (id: string) => { 
      const order = orders.find(o => o.id === id);
      if (order) {
          const updated = { ...order, isArchived: true, archivedAt: new Date().toISOString() };
          setOrders(prev => prev.map(o => o.id === id ? updated : o));
          await apiUpdateOrder(updated);
      }
      showToast('ARQUIVADO', 'success'); 
  };

  const handleReactivateOrder = async (id: string) => { 
      const order = orders.find(o => o.id === id);
      if(order) {
          const updated = { ...order, isArchived: false, archivedAt: undefined, expedicao: 'Pendente' };
          setOrders(prev => prev.map(o => o.id === id ? updated : o));
          await apiUpdateOrder(updated as Order);
      }
      showToast('REATIVADO', 'success'); 
  };

  const handleDeleteOrder = async (id: string) => { 
      const order = orders.find(o => o.id === id);
      if (order) {
          const log: GlobalLogEntry = { id: Date.now().toString(), userId: currentUser?.id || 'sys', userName: currentUser?.nome || 'Sys', timestamp: new Date().toISOString(), actionType: 'DELETE_ORDER', targetInfo: `O.R #${order.or}` };
          handleUpdateLogs([...globalLogs, log]);
      }
      setOrders(prev => prev.filter(o => o.id !== id));
      await apiDeleteOrder(id);
      showToast('EXCLUÍDO', 'error'); 
  };

  const handleBulkDeleteOrders = (ids: string[]) => { 
      // Atualiza Logs
      const newLogs: GlobalLogEntry[] = [];
      const now = new Date().toISOString();
      ids.forEach(id => {
          const order = orders.find(o => o.id === id);
          if (order) {
              newLogs.push({
                  id: Math.random().toString(36).substr(2, 9),
                  userId: currentUser?.id || 'sys',
                  userName: currentUser?.nome || 'Sistema',
                  timestamp: now,
                  actionType: 'DELETE_ORDER',
                  targetInfo: `O.R #${order.or} - ${order.cliente} (Limpeza)`
              });
          }
      });
      handleUpdateLogs([...globalLogs, ...newLogs]);

      // Atualiza UI e Backend
      setOrders(prev => prev.filter(o => !ids.includes(o.id)));
      ids.forEach(async id => await apiDeleteOrder(id));
      showToast('LIMPEZA CONCLUÍDA', 'success'); 
  };

  const handleDeleteUser = (id: string) => {
    const userToDelete = users.find(u => u.id === id);
    if (userToDelete) {
        const log: GlobalLogEntry = { 
            id: Date.now().toString(), 
            userId: currentUser?.id || 'sys', 
            userName: currentUser?.nome || 'Sys', 
            timestamp: new Date().toISOString(), 
            actionType: 'DELETE_USER', 
            targetInfo: `Usuário ${userToDelete.nome}` 
        };
        handleUpdateLogs([...globalLogs, log]);
    }
    const newUsers = users.filter(u => u.id !== id);
    handleUpdateUsers(newUsers);
    showToast('Usuário excluído.', 'success');
  };

  const handleSaveOrder = async (orderData: Partial<Order>[], idsToDelete?: string[]) => {
    // 1. Process deletes
    if (idsToDelete && idsToDelete.length > 0) {
        setOrders(prev => prev.filter(o => !idsToDelete.includes(o.id)));
        for (const id of idsToDelete) await apiDeleteOrder(id);
    }

    // 2. Process updates/creates (Optimistic)
    const newOrdersList = [...orders];
    
    for (const itemData of orderData) {
        if (itemData.id && newOrdersList.some(o => o.id === itemData.id)) {
            // Update UI
            const idx = newOrdersList.findIndex(o => o.id === itemData.id);
            if (idx !== -1) {
                const oldOrder = newOrdersList[idx];
                const newEntry: HistoryEntry = { userId: currentUser?.id || 'sys', userName: currentUser?.nome || 'Sys', timestamp: new Date().toISOString(), status: 'Dados Editados' as any, sector: 'Geral' };
                const updated = { ...oldOrder, ...itemData, history: [...(oldOrder.history || []), newEntry] } as Order;
                newOrdersList[idx] = updated;
                // Backend call in background
                apiUpdateOrder(updated); 
            }
        } else {
            // Create UI
            const newOrder = { 
                ...itemData,
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                createdAt: new Date().toISOString(),
                createdBy: currentUser?.nome,
                preImpressao: 'Pendente', impressao: 'Pendente', producao: 'Pendente', instalacao: 'Pendente', expedicao: 'Pendente',
                isArchived: false,
                history: []
            } as Order;
            newOrdersList.unshift(newOrder); // Add to top
            apiCreateOrder(newOrder);
        }
    }
    setOrders(newOrdersList);
    
    showToast('Salvo com sucesso!', 'success');
    setShowOrderModal(false); 
    setEditingOrder(null);
  };

  const handleLogin = (loginOrName: string, pass: string) => {
    const input = loginOrName.trim().toLowerCase();
    const found = users.find(x => (x.email.toLowerCase() === input || x.nome.toLowerCase() === input) && x.password === pass);
    if (found) { setCurrentUser(found); return true; }
    return false;
  };

  const handleResetRequest = (login: string) => { 
      localStorage.setItem('pcp_reset_request_user', login); 
      const admins = users.filter(u => u.role === 'Admin');
      admins.forEach(admin => {
          addNotification('🔐 RESET DE SENHA', `Usuário "${login}" pediu reset.`, 'urgent', admin.id);
      });
      showToast("Solicitação enviada.", "success");
  };

  // Toggle Logic: Switch between Calendar and List view
  const toggleViewMode = () => {
      setActiveTab(prev => prev === 'CALENDÁRIO' ? 'OPERACIONAL' : 'CALENDÁRIO');
  };

  if (!currentUser) return <Login onLogin={handleLogin} onResetPassword={handleResetRequest} companyLogo={companySettings.logoUrl} />;

  return (
    <div className="h-screen flex flex-col bg-[#fdfdfd] dark:bg-slate-950 overflow-hidden relative transition-colors duration-300">
      <header className="bg-[#064e3b] dark:bg-emerald-950 h-14 flex items-center justify-between px-4 md:px-6 shrink-0 z-50 border-b border-emerald-900 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-inner">{companySettings.logoUrl ? <img src={companySettings.logoUrl} className="w-full h-full object-cover rounded-xl"/> : <span className="font-bold">NC</span>}</div>
          <div><h1 className="text-white font-black text-xs md:text-sm tracking-[2px] uppercase">{companySettings.name.split(' ')[0]}</h1><span className="text-emerald-400 font-black text-[8px] uppercase tracking-[3px]">CONTROL</span></div>
        </div>
        <div className="hidden md:flex flex-1 justify-center">
          <div className={`px-6 py-1.5 bg-black/20 rounded-full border border-white/5 flex items-center gap-3 ${isSyncing ? 'animate-pulse ring-1 ring-emerald-400' : ''}`}>
            <span className="text-emerald-400 font-black text-[10px] uppercase tracking-[2px] tabular-nums">{formatHeaderTime(currentTime)}</span>
            {connectionStatus === 'online' ? (
                <div className="w-2 h-2 bg-emerald-500 rounded-full" title="Online"></div>
            ) : (
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full" title="Modo Offline"></div>
                    <span className="text-[7px] text-slate-400 font-bold uppercase">OFFLINE</span>
                </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-5">
            {/* Ícone de Calendário/Lista (Toggle) */}
            <button 
                onClick={toggleViewMode} 
                className={`p-2 transition-colors ${activeTab === 'CALENDÁRIO' ? 'text-emerald-400' : 'text-white/70 hover:text-emerald-400'}`}
                title={activeTab === 'CALENDÁRIO' ? 'Voltar para Lista' : 'Ver Calendário'}
            >
                {activeTab === 'CALENDÁRIO' ? (
                    // Ícone de Lista
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2.5" strokeLinecap="round"/></svg>
                ) : (
                    // Ícone de Calendário
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth="2.5"/></svg>
                )}
            </button>

            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-white/70 hover:text-yellow-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="2.5"/></svg></button>
            <div className="relative">
                <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-white/70 hover:text-emerald-400"><svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeWidth="2.5"/></svg>{notifications.length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#064e3b]"></span>}</button>
                {showNotifications && <NotificationPanel notifications={notifications} onClose={() => setShowNotifications(false)} onMarkAsRead={handleMarkAsRead} onMarkAllAsRead={handleMarkAllRead} onAction={handleNotificationAction} />}
            </div>
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                <div className="hidden md:flex flex-col items-end"><span className="text-[11px] font-black text-white uppercase">{currentUser.nome}</span><span className="text-[8px] font-bold text-emerald-400 uppercase">{currentUser.cargo}</span></div>
                <button onClick={() => setShowOperatorPanel(true)} className="w-10 h-10 bg-white/10 hover:bg-emerald-500 text-white rounded-2xl flex items-center justify-center transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth="2"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2"/></svg></button>
            </div>
        </div>
      </header>

      <main ref={mainRef} className="flex-1 overflow-auto p-0 md:p-4 pb-20 bg-slate-50/30 dark:bg-slate-900/50">
        <div className="w-full max-w-[1450px] mx-auto space-y-4 p-4 md:p-0">
          <div className="flex flex-col md:flex-row justify-between gap-4">
             {/* Stats Cards - Cores Suaves no Modo Claro, Transparência no Modo Escuro */}
             <div onClick={() => setDashboardFilter('TODAS')} className={`flex-1 p-4 rounded-3xl border flex items-center justify-between cursor-pointer transition-colors ${dashboardFilter === 'TODAS' ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-900/20 dark:border-emerald-500/50' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}>
                <div><p className="text-[9px] font-black text-slate-400 uppercase">Ativas</p><p className="text-3xl font-black text-slate-900 dark:text-white">{stats.total}</p></div>
             </div>
             <div onClick={() => setDashboardFilter('PRODUCAO')} className={`flex-1 p-4 rounded-3xl border flex items-center justify-between cursor-pointer transition-colors ${dashboardFilter === 'PRODUCAO' ? 'bg-amber-50 border-amber-500 dark:bg-amber-900/20 dark:border-amber-500/50' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}>
                <div><p className="text-[9px] font-black text-slate-400 uppercase">Em Produção</p><p className="text-3xl font-black text-amber-500">{stats.emAndamento}</p></div>
             </div>
             <div onClick={() => setDashboardFilter('ATRASADAS')} className={`flex-1 p-4 rounded-3xl border flex items-center justify-between cursor-pointer transition-colors ${dashboardFilter === 'ATRASADAS' ? 'bg-red-50 border-red-500 dark:bg-red-900/20 dark:border-red-500/50' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}>
                <div><p className="text-[9px] font-black text-slate-400 uppercase">Atrasadas</p><p className="text-3xl font-black text-red-500">{stats.atrasadas}</p></div>
             </div>
          </div>

          <div className="flex flex-col gap-3 sticky top-0 z-30">
            <div className="flex flex-row items-center gap-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-2 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <input type="text" placeholder="Buscar..." className="flex-1 w-full pl-4 pr-4 py-3 bg-slate-50 dark:bg-slate-950 rounded-2xl text-[11px] font-bold outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <button onClick={() => { setEditingOrder(null); setShowOrderModal(true); }} className="px-6 py-3 bg-[#064e3b] dark:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-900 transition-all flex items-center gap-2">Nova O.R</button>
            </div>
          </div>

          {activeTab === 'CALENDÁRIO' ? (
             <CalendarView orders={orders} onEditOrder={(o) => { setEditingOrder(o); setShowOrderModal(true); }} onDateClick={handleCalendarDateClick} />
          ) : (
             <ProductionTable 
                orders={filteredOrders} 
                onUpdateStatus={handleUpdateStatus} 
                onEditOrder={(o) => { setEditingOrder(o); setShowOrderModal(true); }}
                onCreateOrder={() => { setEditingOrder(null); setShowOrderModal(true); }}
                onShowQR={(o) => setShowQRModal(o)}
                onDeleteOrder={handleDeleteOrder}
                onReactivateOrder={handleReactivateOrder}
                onArchiveOrder={handleArchiveOrder}
                onShowHistory={(o) => setShowHistoryModal(o)}
                onShowTechSheet={handlePrintTechSheet}
                onDirectPrint={handleDirectPrint}
                currentUser={currentUser}
                onSort={(key) => setSortConfig(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))}
                sortConfig={sortConfig}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onScrollTop={handleScrollToTop}
                onShowScanner={() => setShowScanner(true)}
             />
          )}
        </div>
      </main>

      {/* MODALS */}
      {showQRModal && <QRCodeModal order={showQRModal} companySettings={companySettings} onClose={() => setShowQRModal(null)} />}
      {showOrderModal && <OrderModal order={editingOrder || undefined} existingOrders={orders} onClose={() => { setShowOrderModal(false); setEditingOrder(null); }} onSave={handleSaveOrder} currentUser={currentUser} companySettings={companySettings} showToast={showToast} />}
      {showHistoryModal && <OrderHistoryModal order={showHistoryModal} onClose={() => setShowHistoryModal(null)} />}
      {showUserManagement && <UserManagementModal users={users} orders={orders} companySettings={companySettings} ramais={ramais} globalLogs={globalLogs} onClose={() => setShowUserManagement(false)} onAddUser={(u) => handleUpdateUsers([...users, { ...u, id: Date.now().toString() } as User])} onDeleteUser={handleDeleteUser} onUpdateUser={(u) => handleUpdateUsers(users.map(user => user.id === u.id ? u : user))} onUpdateCompanySettings={handleUpdateSettings} onUpdateRamais={setRamais} onBulkDeleteOrders={handleBulkDeleteOrders} showToast={showToast} />}
      {showOperatorPanel && <OperatorPanel user={currentUser} ramais={ramais} onClose={() => setShowOperatorPanel(false)} onLogout={() => setCurrentUser(null)} onOpenManagement={() => { setShowOperatorPanel(false); setShowUserManagement(true); }} onUpdateUser={(u) => handleUpdateUsers(users.map(user => user.id === currentUser.id ? { ...user, ...u } : user))} onRequestReset={() => handleResetRequest(currentUser.email)} darkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} />}
      {showCreateAlert && <CreateAlertModal users={users} currentUser={currentUser} onClose={() => setShowCreateAlert(false)} onSend={handleCreateAlert} />}
      {showScanner && <QRScannerModal onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />}
      {showTechSheetModal && <TechnicalSheetModal order={showTechSheetModal} allOrders={orders} companySettings={companySettings} onClose={() => setShowTechSheetModal(null)} onEdit={() => { setEditingOrder(showTechSheetModal); setShowTechSheetModal(null); setShowOrderModal(true); }} onUpdateStatus={handleUpdateStatus} onShowQR={(o) => setShowQRModal(o)} currentUser={currentUser} />}
      
      {toast.show && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[1000] animate-in slide-in-from-top border border-white/10 ${toast.type === 'success' ? 'bg-[#064e3b] text-white' : toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-slate-800 text-white'}`}>
          <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default App;
