
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
import { loadOrders, saveOrders } from './services/storageService';
import { generateTechnicalSheetHtml } from './utils/printHelpers';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  // Ref para o container principal de scroll
  const mainRef = useRef<HTMLDivElement>(null);
  
  // Estado do Modo Noturno
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('pcp_users');
    return saved ? JSON.parse(saved) : MOCK_USERS;
  });
  
  const [orders, setOrders] = useState<Order[]>([]);

  // Carregamento Inicial via IndexedDB
  useEffect(() => {
    loadOrders().then((loadedOrders) => {
        setOrders(loadedOrders);
        setIsDataLoaded(true);
    });
  }, []);

  // Estado para Ramais Telefônicos
  const [ramais, setRamais] = useState<Ramal[]>(() => {
    const saved = localStorage.getItem('pcp_ramais');
    return saved ? JSON.parse(saved) : [];
  });

  // Estado para Logs Globais (Exclusões)
  const [globalLogs, setGlobalLogs] = useState<GlobalLogEntry[]>(() => {
    const saved = localStorage.getItem('pcp_global_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [companySettings, setCompanySettings] = useState<CompanySettings>(() => {
    const saved = localStorage.getItem('pcp_company_settings');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      name: parsed.name || 'NEWCOM CONTROL',
      address: parsed.address || 'Rua da Produção, 123 - Distrito Industrial',
      contact: parsed.contact || 'CEP: 00000-000 | Tel: (00) 0000-0000',
      logoUrl: parsed.logoUrl,
      reminderEnabled: parsed.reminderEnabled !== undefined ? parsed.reminderEnabled : false,
      reminderInstallationDays: parsed.reminderInstallationDays || 2,
      reminderShippingDays: parsed.reminderShippingDays || 1
    };
  });

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

  const [manualNotifications, setManualNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem('pcp_manual_notifications');
    let parsed = saved ? JSON.parse(saved) : [];
    parsed = parsed.map((n: any) => ({
        ...n,
        readBy: Array.isArray(n.readBy) ? n.readBy : (n.read ? ['ALL'] : []) 
    }));
    return parsed;
  });
  const [systemNotifications, setSystemNotifications] = useState<Notification[]>([]);

  const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' | 'info' }>({ 
    show: false, message: '', type: 'info' 
  });

  const getLocalTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatHeaderTime = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
        weekday: 'short', 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    };
    return date.toLocaleString('pt-BR', options).toUpperCase().replace(/\.|,/g, '');
  };

  // Função Global de Scroll to Top
  const handleScrollToTop = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      checkAutomatedNotifications();
    }, 60000); 
    checkAutomatedNotifications();
    return () => clearInterval(timer);
  }, [orders, currentUser, companySettings]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    if (isDataLoaded) {
      saveOrders(orders).catch(err => {
        console.error("Erro fatal ao salvar:", err);
        setToast({ show: true, message: 'ERRO AO SALVAR DADOS. Contate o suporte.', type: 'error' });
      });
    }
  }, [orders, isDataLoaded]);

  useEffect(() => {
    localStorage.setItem('pcp_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('pcp_ramais', JSON.stringify(ramais));
  }, [ramais]);

  useEffect(() => {
    try {
        localStorage.setItem('pcp_company_settings', JSON.stringify(companySettings));
    } catch (e) { console.error(e); }
  }, [companySettings]);

  useEffect(() => {
    localStorage.setItem('pcp_manual_notifications', JSON.stringify(manualNotifications));
  }, [manualNotifications]);

  useEffect(() => {
    localStorage.setItem('pcp_global_logs', JSON.stringify(globalLogs));
  }, [globalLogs]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  // Função centralizada para adicionar notificações
  const addNotification = (title: string, message: string, type: 'urgent' | 'warning' | 'info' | 'success', targetId: string = 'ALL', sector?: string) => {
    const newNotif: Notification = {
      id: Date.now().toString() + Math.random().toString(), // Garante ID único
      title,
      message,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      readBy: [],
      targetUserId: targetId,
      targetSector: sector || 'Geral'
    };
    
    setSystemNotifications(prev => {
        // Evita duplicatas exatas de mensagem recente no mesmo dia
        const isDuplicate = prev.some(n => n.title === title && n.message === message && n.targetUserId === targetId);
        if (isDuplicate) return prev;
        return [newNotif, ...prev].slice(0, 50); // Mantém histórico das últimas 50
    });
  };

  const checkAutomatedNotifications = () => {
    if (!currentUser) return;
    const todayStr = getLocalTodayStr();
    
    const newAlerts: Notification[] = [];

    orders.forEach(o => {
      if (o.isArchived) return;

      // 1. É HOJE (Atenção Prazo)
      if (o.dataEntrega === todayStr) {
        newAlerts.push({ 
            id: `today-${o.id}-${todayStr}`, // ID único por dia
            title: '📅 ATENÇÃO: PRAZO HOJE', 
            message: `O.R #${o.or} vence hoje. Prioridade máxima.`, 
            type: 'warning', 
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
            readBy: [], targetUserId: 'ALL', targetSector: 'Geral', referenceDate: o.dataEntrega 
        });
      }
      
      // 2. ATRASADO (Urgente Atrasado)
      if (o.dataEntrega < todayStr) {
        newAlerts.push({ 
            id: `delay-${o.id}-${todayStr}`, // ID único por dia para não spammar a cada minuto
            title: '🚨 URGENTE: ATRASADO', 
            message: `O.R #${o.or} está atrasada! Data: ${o.dataEntrega.split('-').reverse().join('/')}`, 
            type: 'urgent', 
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
            readBy: [], targetUserId: 'ALL', targetSector: 'Geral', referenceDate: o.dataEntrega 
        });
      }
    });

    setSystemNotifications(prev => {
        // Filtra para adicionar apenas se o ID específico (que inclui a data) ainda não existir
        const currentIds = new Set(prev.map(n => n.id));
        const uniqueNewAlerts = newAlerts.filter(a => !currentIds.has(a.id));
        
        if (uniqueNewAlerts.length === 0) return prev;
        return [...uniqueNewAlerts, ...prev].slice(0, 50);
    });
  };

  const notifications = useMemo(() => {
    if (!currentUser) return [];
    
    // Combina notificações manuais e do sistema
    const allNotifs = [...manualNotifications, ...systemNotifications];

    const visibleNotifs = allNotifs.filter(n => {
       const isForUser = n.targetUserId === 'ALL' || n.targetUserId === currentUser.id;
       if (!isForUser) return false;
       // Se o usuário já leu, não mostra mais (comportamento de "limpar")
       if (n.readBy.includes(currentUser.id)) return false;
       return true;
    });

    const typePriority = { urgent: 3, warning: 2, success: 1, info: 0 };
    
    return visibleNotifs.sort((a, b) => {
        const priorityDiff = typePriority[b.type] - typePriority[a.type];
        if (priorityDiff !== 0) return priorityDiff;
        return b.id.localeCompare(a.id); 
    });
  }, [manualNotifications, systemNotifications, currentUser]);

  const handleCreateAlert = (targetUserId: string, title: string, message: string, type: Notification['type'], date?: string) => {
    const newAlert: Notification = { 
        id: `manual-${Date.now()}`, 
        title: title.toUpperCase(), 
        message, 
        type, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
        readBy: [], 
        targetUserId, 
        senderName: currentUser?.nome, 
        referenceDate: date, 
        targetSector: 'Geral' 
    };
    setManualNotifications(prev => [newAlert, ...prev]);
    showToast('Alerta enviado!', 'success');
  };

  const handleMarkAsRead = (id: string) => {
    if (!currentUser) return;
    const userId = currentUser.id;
    const updateReadBy = (n: Notification) => { 
        if (n.id === id && !n.readBy.includes(userId)) return { ...n, readBy: [...n.readBy, userId] }; 
        return n; 
    };
    setManualNotifications(prev => prev.map(updateReadBy)); 
    setSystemNotifications(prev => prev.map(updateReadBy));
  };

  const handleMarkAllRead = () => {
    if (!currentUser) return;
    const userId = currentUser.id;
    const updateAll = (n: Notification) => { 
        const isTarget = n.targetUserId === 'ALL' || n.targetUserId === userId; 
        if (isTarget && !n.readBy.includes(userId)) return { ...n, readBy: [...n.readBy, userId] }; 
        return n; 
    };
    setManualNotifications(prev => prev.map(updateAll)); 
    setSystemNotifications(prev => prev.map(updateAll));
  };

  const handleNotificationAction = (notification: Notification) => { 
      if (notification.metadata && notification.metadata.type === 'RESET_PASSWORD') {
          const targetLogin = String(notification.metadata.targetUserLogin || '').trim();
          if (!targetLogin) { showToast(`Erro: Identificação inválida.`, 'error'); return; }

          const targetUser = users.find(u => {
             const userEmail = u.email.toLowerCase().trim();
             const userName = u.nome.toLowerCase().trim();
             const search = targetLogin.toLowerCase();
             return userEmail === search || userName === search || userEmail.includes(search) || userName.includes(search);
          });

          if (targetUser) {
              setUsers(prevUsers => {
                  return prevUsers.map(user => user.id === targetUser.id ? { ...user, password: '1234' } : user);
              });
              // Marca como lida/resolvida para o admin
              handleMarkAsRead(notification.id);
              showToast(`Senha de "${targetUser.nome}" resetada para 1234`, 'success');
          } else {
              showToast(`Erro: Usuário "${targetLogin}" não encontrado.`, 'error');
          }
      }
  };

  const handleScanSuccess = (decodedText: string) => {
    setShowScanner(false);
    const orMatch = decodedText.match(/#(\w+)/);
    const orNumber = orMatch ? orMatch[1] : null;

    const foundOrder = orders.find(o => 
      o.or === orNumber || 
      decodedText.includes(o.or) || 
      decodedText.includes(o.id)
    );

    if (foundOrder) {
      // Abre a Ficha Técnica para leitura completa (e impressão HTML se desejar)
      setShowTechSheetModal(foundOrder);
      showToast(`O.R #${foundOrder.or} carregada!`, 'success');
    } else {
      showToast('O.R não encontrada no sistema.', 'error');
    }
  };

  const handlePrintTechSheet = (order: Order) => {
    setShowTechSheetModal(order);
  };

  const handleDirectPrint = (order: Order) => {
    const html = generateTechnicalSheetHtml(order, orders, companySettings);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.write('<script>window.onload = function() { window.print(); }</script>');
      printWindow.document.close();
    }
  };

  // Funcao para filtrar pela data ao clicar no calendário
  const handleCalendarDateClick = (dateStr: string) => {
      // Data vem como YYYY-MM-DD
      const formattedDate = dateStr.split('-').reverse().join('/'); // DD/MM/YYYY
      setSearchTerm(formattedDate);
      setActiveTab('OPERACIONAL');
      setDashboardFilter('TODAS');
      showToast(`Filtrando por: ${formattedDate}`, 'info');
  };

  const stats = useMemo(() => {
    const active = orders.filter(o => !o.isArchived);
    const today = new Date().toISOString().split('T')[0];
    return {
      total: active.length,
      emAndamento: active.filter(o => 
        o.preImpressao === 'Em Produção' || o.impressao === 'Em Produção' || 
        o.producao === 'Em Produção' || o.instalacao === 'Em Produção' || o.expedicao === 'Em Produção'
      ).length,
      atrasadas: active.filter(o => o.dataEntrega < today).length
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => {
      const term = debouncedSearch.toLowerCase();
      const dateFormatted = o.dataEntrega.split('-').reverse().join('/');
      // Busca expandida: OR, Cliente, Vendedor, Item, Referencia
      const matchesSearch = 
        o.cliente.toLowerCase().includes(term) || 
        o.or.toLowerCase().includes(term) || 
        o.vendedor.toLowerCase().includes(term) ||
        o.item.toLowerCase().includes(term) ||
        (o.numeroItem && o.numeroItem.toLowerCase().includes(term)) ||
        dateFormatted.includes(term);
      
      if (activeTab === 'CALENDÁRIO') return matchesSearch;
      const matchesTab = activeTab === 'OPERACIONAL' ? !o.isArchived : o.isArchived;
      return matchesTab && matchesSearch;
    });

    if (activeTab === 'OPERACIONAL' && dashboardFilter !== 'TODAS') {
      if (dashboardFilter === 'PRODUCAO') {
        result = result.filter(o => o.preImpressao === 'Em Produção' || o.impressao === 'Em Produção' || o.producao === 'Em Produção' || o.instalacao === 'Em Produção' || o.expedicao === 'Em Produção');
      } else if (dashboardFilter === 'ATRASADAS') {
        const today = new Date().toISOString().split('T')[0];
        result = result.filter(o => o.dataEntrega < today);
      }
    }
    return result;
  }, [orders, activeTab, debouncedSearch, dashboardFilter]);

  const handleUpdateStatus = (id: string, step: ProductionStep, next: Status) => {
    setOrders(prevOrders => {
      return prevOrders.map(order => {
        if (order.id !== id) return order;
        const newEntry: HistoryEntry = { userId: currentUser?.id || 'sistema', userName: currentUser?.nome || 'Sistema', timestamp: new Date().toISOString(), status: next, sector: step };
        const updatedOrder = { ...order, [step]: next, history: [...(order.history || []), newEntry] };
        
        if (step === 'expedicao' && next === 'Concluído') { 
            updatedOrder.isArchived = true; 
            updatedOrder.archivedAt = new Date().toISOString(); 
            showToast('FINALIZADO E ARQUIVADO', 'success'); 
            addNotification('✅ O.R CONCLUÍDA', `O.R #${order.or} foi finalizada e arquivada por ${currentUser?.nome}.`, 'success', 'ALL', 'Geral');
        } 
        
        return updatedOrder;
      });
    });
  };

  const handleArchiveOrder = (id: string) => { 
      setOrders(prev => prev.map(o => o.id !== id ? o : { ...o, isArchived: true, archivedAt: new Date().toISOString() })); 
      showToast('ARQUIVADO', 'success'); 
  };

  const handleReactivateOrder = (id: string) => { 
      const order = orders.find(o => o.id === id);
      if(order) {
          // NOTIFICAÇÃO ESPECÍFICA DE RETORNO
          addNotification('♻️ RETORNO À PRODUÇÃO', `O.R #${order.or} foi reativada por ${currentUser?.nome}.`, 'warning', 'ALL', 'Geral');
      }
      setOrders(prev => prev.map(o => o.id !== id ? o : { ...o, isArchived: false, archivedAt: undefined, expedicao: 'Pendente' })); 
      showToast('REATIVADO', 'success'); 
  };

  const handleDeleteOrder = (id: string) => { 
      const orderToDelete = orders.find(o => o.id === id);
      if (orderToDelete) {
          const log: GlobalLogEntry = {
              id: Date.now().toString(),
              userId: currentUser?.id || 'sys',
              userName: currentUser?.nome || 'Sistema',
              timestamp: new Date().toISOString(),
              actionType: 'DELETE_ORDER',
              targetInfo: `O.R #${orderToDelete.or} - ${orderToDelete.cliente}`
          };
          setGlobalLogs(prev => [log, ...prev]);
      }
      setOrders(prev => prev.filter(o => o.id !== id)); 
      showToast('EXCLUÍDO', 'error'); 
  };

  const handleBulkDeleteOrders = (ids: string[]) => { 
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
      setGlobalLogs(prev => [...newLogs, ...prev]);
      setOrders(prev => prev.filter(o => !ids.includes(o.id))); 
      showToast('LIMPEZA CONCLUÍDA', 'success'); 
  };

  const handleDeleteUser = (id: string) => { setUsers(p => p.filter(u => u.id !== id)); showToast('USUÁRIO REMOVIDO', 'error'); };
  
  const handleSaveOrder = (orderData: Partial<Order>[], idsToDelete?: string[]) => {
    let ordersAfterDelete = [...orders];
    if (idsToDelete && idsToDelete.length > 0) {
        ordersAfterDelete = ordersAfterDelete.filter(o => !idsToDelete.includes(o.id));
    }

    let updatesCount = 0;
    let newOrdersAdded = 0;
    
    // Variáveis para rastrear notificações específicas
    const notifDetails = {
        newItem: false,
        editedItem: false,
        newAttachment: false,
        deletedAttachment: false,
        orNumber: orderData[0]?.or || '?'
    };
    
    setOrders(prevOrders => {
        let updatedOrders = [...ordersAfterDelete];
        
        orderData.forEach(itemData => {
            if (itemData.id && prevOrders.some(o => o.id === itemData.id)) {
                // EDIÇÃO DE ITEM EXISTENTE
                updatesCount++;
                const oldOrder = prevOrders.find(o => o.id === itemData.id);
                if (oldOrder) {
                    let actionDetail = 'Dados Editados';
                    const oldAttachCount = oldOrder.attachments?.length || 0;
                    const newAttachCount = itemData.attachments?.length || 0;

                    if (oldOrder.item !== itemData.item || oldOrder.quantidade !== itemData.quantidade) {
                        notifDetails.editedItem = true;
                    }
                    if (newAttachCount > oldAttachCount) {
                        notifDetails.newAttachment = true;
                        actionDetail = 'Novo Anexo';
                    }
                    if (newAttachCount < oldAttachCount) {
                        notifDetails.deletedAttachment = true;
                    }

                    const newEntry: HistoryEntry = { 
                        userId: currentUser?.id || 'sys', 
                        userName: currentUser?.nome || 'Sistema', 
                        timestamp: new Date().toISOString(), 
                        status: actionDetail as any, 
                        sector: 'Geral' 
                    };
                    updatedOrders = updatedOrders.map(o => o.id === itemData.id ? { 
                        ...o, 
                        ...itemData, 
                        history: [...(o.history || []), newEntry] 
                    } : o);
                }
            } else {
                // NOVO ITEM
                newOrdersAdded++;
                notifDetails.newItem = true;
                const newOrder: Order = { 
                    ...itemData,
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    createdAt: new Date().toISOString(),
                    createdBy: currentUser?.nome,
                    preImpressao: 'Pendente', 
                    impressao: 'Pendente', 
                    producao: 'Pendente', 
                    instalacao: 'Pendente', 
                    expedicao: 'Pendente', 
                    isArchived: false,
                    history: []
                } as Order;
                updatedOrders = [newOrder, ...updatedOrders];
            }
        });
        return updatedOrders;
    });

    const deletedCount = idsToDelete ? idsToDelete.length : 0;
    if (deletedCount > 0) showToast(`${deletedCount} item(s) removido(s) da O.R #${notifDetails.orNumber}.`, 'info');
    
    // GERAÇÃO DE NOTIFICAÇÕES ESPECÍFICAS
    if (notifDetails.newItem) {
        addNotification('✨ NOVA O.R / ITEM', `Novos itens adicionados à O.R #${notifDetails.orNumber} por ${currentUser?.nome}.`, 'success', 'ALL', 'Geral');
    }
    if (notifDetails.editedItem) {
        addNotification('✏️ ITEM EDITADO', `Alterações nos itens da O.R #${notifDetails.orNumber}.`, 'info', 'ALL', 'Geral');
    }
    if (notifDetails.newAttachment) {
        addNotification('📎 NOVO ANEXO', `Novos arquivos anexados à O.R #${notifDetails.orNumber}.`, 'info', 'ALL', 'Geral');
    }
    if (notifDetails.deletedAttachment) {
        addNotification('🗑️ ANEXO REMOVIDO', `Arquivos removidos da O.R #${notifDetails.orNumber}.`, 'warning', 'ALL', 'Geral');
    }

    if (updatesCount > 0 || newOrdersAdded > 0) {
        showToast('Salvo com sucesso!', 'success');
    }
    
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
      // Busca todos os administradores para notificar
      const admins = users.filter(u => u.role === 'Admin');
      
      if (admins.length === 0) {
          showToast("Erro: Nenhum administrador encontrado.", "error");
          return;
      }

      admins.forEach(admin => {
          const newNotif: Notification = { 
              id: `reset-${login}-${Date.now()}`, 
              title: '🔐 PEDIDO DE RESET DE SENHA', 
              message: `O usuário "${login}" solicitou o reset de senha para "1234".`, 
              type: 'urgent', 
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
              readBy: [], 
              targetUserId: admin.id, // Envia apenas para o Admin específico
              senderName: 'Sistema', 
              targetSector: 'Geral',
              actionLabel: 'RESETAR AGORA (1234)',
              metadata: { type: 'RESET_PASSWORD', targetUserLogin: login }
          };
          setManualNotifications(prev => [...prev, newNotif]);
      });
      
      showToast("Solicitação enviada aos administradores.", "success");
  };

  if (!currentUser) {
    return (
      <Login 
        onLogin={handleLogin} 
        onResetPassword={handleResetRequest} 
        companyLogo={companySettings.logoUrl}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#fdfdfd] dark:bg-slate-950 overflow-hidden relative transition-colors duration-300">
      
      {/* Header Responsivo */}
      <header className="bg-[#064e3b] dark:bg-emerald-950 md:h-14 h-14 flex items-center justify-between px-4 md:px-6 shrink-0 z-50 border-b border-emerald-900 shadow-xl transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-inner group relative overflow-hidden">
             {companySettings.logoUrl ? (
               <img src={companySettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
             ) : (
               <svg className="w-5 h-5 md:w-7 md:h-7 transform group-hover:scale-110 transition-transform duration-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L4 7L12 12L20 7L12 2Z" fill="currentColor" fillOpacity="0.4"/>
                  <path d="M12 12L4 17L12 22L20 17L12 12Z" fill="currentColor" fillOpacity="0.2"/>
                  <path d="M4 7V17L12 12L4 7Z" fill="currentColor" fillOpacity="0.7"/>
                  <path d="M20 7V17L12 12L20 7Z" fill="currentColor"/>
               </svg>
             )}
          </div>
          <div className="flex flex-col">
            <h1 className="text-white font-black text-xs md:text-sm tracking-[2px] uppercase leading-none">{companySettings.name.split(' ')[0]}</h1>
            <span className="text-emerald-400 font-black text-[8px] uppercase tracking-[3px] mt-1 italic leading-none">CONTROL</span>
          </div>
        </div>

        {/* Data/Hora - Desktop Only */}
        <div className="flex-1 justify-center hidden md:flex">
          <div className="px-6 py-1.5 bg-black/20 rounded-full border border-white/5 backdrop-blur-sm">
            <span className="text-emerald-400 font-black text-[10px] uppercase tracking-[2px] tabular-nums">
              {formatHeaderTime(currentTime)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-5">
          <div className="flex items-center gap-1 md:gap-5">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 md:p-2.5 text-white/70 hover:text-yellow-400 hover:bg-white/10 rounded-xl transition-all" title={isDarkMode ? "Modo Claro" : "Modo Escuro"}>
              {isDarkMode ? (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="2.5"/></svg>) : (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" strokeWidth="2.5"/></svg>)}
            </button>
            
            {/* Create Alert - Botão visível também no mobile agora */}
            <button onClick={() => setShowCreateAlert(true)} className="p-2 md:p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all" title="Enviar Alerta">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" strokeWidth="2.5"/></svg>
            </button>
          </div>

          <div className="relative">
            <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 md:p-2.5 text-white/70 hover:text-emerald-400 hover:bg-white/5 rounded-xl transition-all relative">
              <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {notifications.length > 0 && (<span className="absolute top-1.5 right-1.5 md:top-2 md:right-2 w-2.5 h-2.5 bg-red-500 border-2 border-[#064e3b] rounded-full"></span>)}
            </button>
            {showNotifications && <NotificationPanel notifications={notifications} onClose={() => setShowNotifications(false)} onMarkAsRead={handleMarkAsRead} onMarkAllAsRead={handleMarkAllRead} onAction={handleNotificationAction} />}
          </div>

          {/* Desktop Calendar Btn */}
          <button onClick={() => setActiveTab(activeTab === 'CALENDÁRIO' ? 'OPERACIONAL' : 'CALENDÁRIO')} className={`hidden md:flex items-center gap-2 px-5 py-2 rounded-xl transition-all border ${activeTab === 'CALENDÁRIO' ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg' : 'text-white/70 hover:text-white border-white/10 hover:bg-white/10'}`}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span className="text-[10px] font-black uppercase tracking-wider">Calendário</span>
          </button>

          <div className="flex items-center gap-3 md:pl-4 md:border-l border-white/10">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[11px] font-black text-white uppercase tracking-wider">{currentUser.nome}</span>
              <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-tight opacity-80">{currentUser.cargo || 'OPERADOR'}</span>
            </div>
            
            <button onClick={() => setShowOperatorPanel(true)} className="w-10 h-10 bg-white/10 hover:bg-emerald-500 text-white rounded-2xl flex items-center justify-center transition-all shadow-sm border border-white/5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth="2"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2"/></svg>
            </button>
          </div>
          <button onClick={() => setCurrentUser(null)} className="hidden md:block text-white/50 hover:text-red-400 text-[10px] font-black uppercase tracking-widest transition-colors">Sair</button>
        </div>
      </header>

      {/* Main Content Area */}
      <main ref={mainRef} className="flex-1 overflow-auto p-0 md:p-4 pb-20 bg-slate-50/30 dark:bg-slate-900/50 transition-colors duration-300">
        <div className="w-full max-w-[1450px] mx-auto space-y-4 p-4 md:p-0">
          
          {/* Dashboard Stats */}
          <div className="flex flex-col landscape:grid landscape:grid-cols-3 gap-3 md:grid md:grid-cols-3">
             {/* ... Stats Cards ... */}
             <div onClick={() => setDashboardFilter('TODAS')} className={`min-w-[180px] p-4 md:p-5 rounded-3xl border flex items-center justify-between shadow-sm cursor-pointer transition-all ${dashboardFilter === 'TODAS' ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-900/30 dark:border-emerald-700' : 'bg-white border-slate-200 hover:border-emerald-300 dark:bg-slate-900 dark:border-slate-800'}`}>
              <div>
                <p className="text-[8px] md:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ativas</p>
                <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">{stats.total}</p>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2"/></svg>
              </div>
            </div>
            <div onClick={() => setDashboardFilter('PRODUCAO')} className={`min-w-[180px] p-4 md:p-5 rounded-3xl border flex items-center justify-between shadow-sm cursor-pointer transition-all ${dashboardFilter === 'PRODUCAO' ? 'bg-amber-50 border-amber-500 dark:bg-amber-900/30 dark:border-amber-700' : 'bg-white border-slate-200 hover:border-amber-300 dark:bg-slate-900 dark:border-slate-800'}`}>
              <div>
                <p className="text-[8px] md:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Em Produção</p>
                <p className="text-2xl md:text-3xl font-black text-amber-500 dark:text-amber-400 mt-1">{stats.emAndamento}</p>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100 dark:bg-amber-900/50 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2.5"/></svg>
              </div>
            </div>
            <div onClick={() => setDashboardFilter('ATRASADAS')} className={`min-w-[180px] p-4 md:p-5 rounded-3xl border flex items-center justify-between shadow-sm cursor-pointer transition-all ${dashboardFilter === 'ATRASADAS' ? 'bg-red-50 border-red-500 dark:bg-red-900/30 dark:border-red-700' : 'bg-white border-slate-200 hover:border-red-300 dark:bg-slate-900 dark:border-slate-800'}`}>
              <div>
                <p className="text-[8px] md:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Atrasadas</p>
                <p className="text-2xl md:text-3xl font-black text-red-500 dark:text-red-400 mt-1">{stats.atrasadas}</p>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-red-100 dark:bg-red-900/50 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5"/></svg>
              </div>
            </div>
          </div>

          {/* Search Bar & Create Button */}
          <div className="flex flex-col gap-3 sticky top-0 z-30">
            <div className="flex flex-row items-center gap-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-2 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                <div className="relative flex-1">
                <input 
                    type="text" 
                    placeholder="Buscar O.R, Cliente, Item, Ref ou Vendedor..." 
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 rounded-2xl text-[11px] font-bold outline-none border border-transparent focus:border-emerald-500 dark:focus:border-emerald-500 transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5"/></svg>
                {/* Desktop QR Scan Button (Hidden on Mobile) */}
                <button onClick={() => setShowScanner(true)} className="hidden md:block absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v1m6 11h2m-6 0h-2v4h2v-4zM6 8v4h4V8H6zm14 10.5c0 .276-.224.5-.5.5h-3a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v3z" strokeWidth="2"/></svg>
                </button>
              </div>
              <button 
                onClick={() => { setEditingOrder(null); setShowOrderModal(true); }}
                className="px-6 py-3 bg-[#064e3b] dark:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-900 dark:hover:bg-emerald-600 transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="3"/></svg>
                Nova O.R
              </button>
            </div>
          </div>

          {activeTab === 'CALENDÁRIO' ? (
             <CalendarView 
                orders={orders} 
                onEditOrder={(o) => { setEditingOrder(o); setShowOrderModal(true); }}
                onDateClick={handleCalendarDateClick}
             />
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

      {/* NEW FIXED BOTTOM DOCK NAVIGATION (MOBILE ONLY) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe-bottom bg-transparent pointer-events-none">
         <div className="w-full h-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] flex items-center justify-between px-6 pointer-events-auto relative">
            
            {/* Left Tab: Produção */}
            <button 
                onClick={() => setActiveTab('OPERACIONAL')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${activeTab === 'OPERACIONAL' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}
            >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'OPERACIONAL' ? 'text-emerald-600' : 'text-slate-400'}`}>Produção</span>
            </button>

            {/* Center Floating QR Button */}
            <div className="relative -top-6">
                <button 
                    onClick={() => setShowScanner(true)}
                    className="w-16 h-16 bg-[#064e3b] dark:bg-emerald-600 text-white rounded-full shadow-[0_8px_20px_rgba(6,78,59,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all border-4 border-slate-100 dark:border-slate-950"
                >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v1m6 11h2m-6 0h-2v4h2v-4zM6 8v4h4V8H6zm14 10.5c0 .276-.224.5-.5.5h-3a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v3z" strokeWidth="2"/></svg>
                </button>
            </div>

            {/* Right Tab: Arquivos */}
            <button 
                onClick={() => setActiveTab('CONCLUÍDAS')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${activeTab === 'CONCLUÍDAS' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}
            >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'CONCLUÍDAS' ? 'text-emerald-600' : 'text-slate-400'}`}>Arquivos</span>
            </button>

         </div>
      </div>

      {/* MODALS */}
      {showQRModal && <QRCodeModal order={showQRModal} companySettings={companySettings} onClose={() => setShowQRModal(null)} />}
      
      {showOrderModal && (
        <OrderModal 
          order={editingOrder || undefined} 
          existingOrders={orders}
          onClose={() => { setShowOrderModal(false); setEditingOrder(null); }} 
          onSave={handleSaveOrder}
          currentUser={currentUser}
          companySettings={companySettings}
          showToast={showToast}
        />
      )}

      {showHistoryModal && <OrderHistoryModal order={showHistoryModal} onClose={() => setShowHistoryModal(null)} />}

      {showUserManagement && (
        <UserManagementModal 
          users={users} 
          orders={orders}
          companySettings={companySettings}
          ramais={ramais}
          globalLogs={globalLogs}
          onClose={() => setShowUserManagement(false)}
          onAddUser={(u) => setUsers([...users, { ...u, id: Date.now().toString() } as User])}
          onDeleteUser={handleDeleteUser}
          onUpdateUser={(u) => setUsers(users.map(user => user.id === u.id ? u : user))}
          onUpdateCompanySettings={setCompanySettings}
          onUpdateRamais={setRamais}
          onBulkDeleteOrders={handleBulkDeleteOrders}
          showToast={showToast}
        />
      )}

      {showOperatorPanel && (
        <OperatorPanel 
          user={currentUser} 
          ramais={ramais}
          onClose={() => setShowOperatorPanel(false)} 
          onLogout={() => setCurrentUser(null)}
          onOpenManagement={() => { setShowOperatorPanel(false); setShowUserManagement(true); }}
          onUpdateUser={(u) => setUsers(users.map(user => user.id === currentUser.id ? { ...user, ...u } : user))}
          onRequestReset={() => handleResetRequest(currentUser.email)}
          darkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        />
      )}

      {showCreateAlert && (
        <CreateAlertModal 
          users={users} 
          currentUser={currentUser} 
          onClose={() => setShowCreateAlert(false)} 
          onSend={handleCreateAlert} 
        />
      )}

      {showScanner && (
        <QRScannerModal 
           onScanSuccess={handleScanSuccess} 
           onClose={() => setShowScanner(false)} 
        />
      )}

      {showTechSheetModal && (
        <TechnicalSheetModal 
          order={showTechSheetModal}
          allOrders={orders}
          companySettings={companySettings}
          onClose={() => setShowTechSheetModal(null)}
          onEdit={() => {
             setEditingOrder(showTechSheetModal);
             setShowTechSheetModal(null);
             setShowOrderModal(true);
          }}
          onUpdateStatus={handleUpdateStatus}
          onShowQR={(o) => setShowQRModal(o)}
          currentUser={currentUser}
        />
      )}

      {/* TOAST NOTIFICATION - CENTERED TOP */}
      {toast.show && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[1000] animate-in slide-in-from-top duration-300 border border-white/10 ${
          toast.type === 'success' ? 'bg-[#064e3b] text-white' : 
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-slate-800 text-white'
        }`}>
          {toast.type === 'success' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3"/></svg>}
          {toast.type === 'error' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3"/></svg>}
          {toast.type === 'info' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5"/></svg>}
          <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
};

export default App;
