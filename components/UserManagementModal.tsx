
import React, { useState, useMemo, useRef } from 'react';
import { User, UserRole, DEPARTMENTS, Order, HistoryEntry, CompanySettings, Ramal, GlobalLogEntry } from '../types';
import { DEFAULT_USER_PASS } from '../constants';

interface UserManagementModalProps {
  users: User[];
  orders: Order[];
  companySettings: CompanySettings;
  ramais: Ramal[];
  globalLogs: GlobalLogEntry[];
  onClose: () => void;
  onAddUser: (user: Partial<User>) => void;
  onDeleteUser: (id: string) => void;
  onUpdateUser: (user: User) => void;
  onUpdateCompanySettings: (settings: CompanySettings) => void;
  onUpdateRamais: (ramais: Ramal[]) => void;
  onBulkDeleteOrders?: (ids: string[]) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ 
  users, 
  orders, 
  companySettings, 
  ramais,
  globalLogs,
  onClose, 
  onAddUser, 
  onDeleteUser, 
  onUpdateUser,
  onUpdateCompanySettings,
  onUpdateRamais,
  onBulkDeleteOrders,
  showToast
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; userId: string | null; userName: string | null }>({ isOpen: false, userId: null, userName: null });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [logSearchTerm, setLogSearchTerm] = useState('');

  const [activeTab, setActiveTab] = useState<'USUÁRIOS' | 'LOGS' | 'CONFIGURAÇÕES' | 'RAMAIS' | 'MANUTENÇÃO' | 'RELATÓRIOS'>('USUÁRIOS');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [passwordValue, setPasswordValue] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  
  const [newRamal, setNewRamal] = useState<Partial<Ramal>>({ nome: '', numero: '', departamento: '' });

  // Manutenção States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [previewItems, setPreviewItems] = useState<Order[] | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [securityStep, setSecurityStep] = useState<'IDLE' | 'VERIFYING'>('IDLE');
  const [generatedToken, setGeneratedToken] = useState<string>('');
  const [inputToken, setInputToken] = useState('');

  // Relatórios States
  const [reportStartDate, setReportStartDate] = useState(() => {
      const date = new Date();
      date.setDate(1); // Primeiro dia do mês atual
      return date.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [localSettings, setLocalSettings] = useState<CompanySettings>(companySettings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- STATS CALCULATION FOR REPORTS ---
  const stats = useMemo(() => {
      // Filtragem por data (usando createdAt)
      const filteredOrders = orders.filter(o => {
          if (!o.createdAt) return false;
          const createdDate = o.createdAt.split('T')[0];
          return createdDate >= reportStartDate && createdDate <= reportEndDate;
      });

      const totalOrders = filteredOrders.length;
      const totalArchived = filteredOrders.filter(o => o.isArchived).length;
      const totalActive = totalOrders - totalArchived;
      const totalRemakes = filteredOrders.filter(o => o.isRemake).length;
      
      // 1. Vendor Stats (Top 5)
      const vendorCounts: Record<string, { total: number, active: number, remakes: number }> = {};
      filteredOrders.forEach(o => {
          const v = o.vendedor || 'N/A';
          if (!vendorCounts[v]) vendorCounts[v] = { total: 0, active: 0, remakes: 0 };
          vendorCounts[v].total++;
          if (!o.isArchived) vendorCounts[v].active++;
          if (o.isRemake) vendorCounts[v].remakes++;
      });
      const vendorList = Object.entries(vendorCounts)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);

      // 2. Client Stats (Top 5)
      const clientCounts: Record<string, number> = {};
      filteredOrders.forEach(o => {
          const c = o.cliente || 'N/A';
          clientCounts[c] = (clientCounts[c] || 0) + 1;
      });
      const topClients = Object.entries(clientCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

      // 3. Sector Efficiency & Load Stats
      // Load: Quantidade de itens que NÃO estão 'Concluído' (Pendente ou Em Produção)
      const sectorLoad = {
          preImpressao: 0,
          impressao: 0,
          producao: 0,
          instalacao: 0,
          expedicao: 0
      };

      // Efficiency: Tempos médios
      const sectorStats: Record<string, { 
          topUser: string; 
          maxCount: number; 
          userCounts: Record<string, number>;
          durations: number[]; // em minutos
      }> = {};

      Object.keys(DEPARTMENTS).forEach(k => {
          sectorStats[k] = { topUser: '-', maxCount: 0, userCounts: {}, durations: [] };
      });

      filteredOrders.forEach(o => {
          // Calculate Load (Active items only)
          if (!o.isArchived) {
              if (o.preImpressao !== 'Concluído') sectorLoad.preImpressao++;
              if (o.impressao !== 'Concluído') sectorLoad.impressao++;
              if (o.producao !== 'Concluído') sectorLoad.producao++;
              if (o.instalacao !== 'Concluído') sectorLoad.instalacao++;
              if (o.expedicao !== 'Concluído') sectorLoad.expedicao++;
          }

          if (!o.history) return;
          
          // Agrupar histórico por setor para calcular tempos
          const sectorTransitions: Record<string, { start?: Date, end?: Date }> = {};

          o.history.forEach(h => {
              // Contagem de quem finalizou
              if (h.status === 'Concluído') {
                  if (!sectorStats[h.sector]) sectorStats[h.sector] = { topUser: '-', maxCount: 0, userCounts: {}, durations: [] };
                  const s = sectorStats[h.sector];
                  s.userCounts[h.userName] = (s.userCounts[h.userName] || 0) + 1;
                  
                  // Atualiza Top User
                  if (s.userCounts[h.userName] > s.maxCount) {
                      s.maxCount = s.userCounts[h.userName];
                      s.topUser = h.userName;
                  }
                  
                  if (!sectorTransitions[h.sector]) sectorTransitions[h.sector] = {};
                  sectorTransitions[h.sector].end = new Date(h.timestamp);
              }

              if (h.status === 'Em Produção') {
                  if (!sectorTransitions[h.sector]) sectorTransitions[h.sector] = {};
                  sectorTransitions[h.sector].start = new Date(h.timestamp);
              }
          });

          // Calcular duração se houver par Start/End
          Object.entries(sectorTransitions).forEach(([sec, times]) => {
              if (times.start && times.end && sectorStats[sec]) {
                  const diffMinutes = (times.end.getTime() - times.start.getTime()) / 1000 / 60;
                  if (diffMinutes > 0) sectorStats[sec].durations.push(diffMinutes);
              }
          });
      });

      // Calcular médias e formatar
      const sectorPerformance = Object.entries(sectorStats).map(([key, data]) => {
          const avgMinutes = data.durations.length > 0 
              ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length 
              : 0;
          
          // Formatar tempo
          let timeDisplay = '-';
          if (avgMinutes > 0) {
              if (avgMinutes < 60) timeDisplay = `${Math.round(avgMinutes)} min`;
              else {
                  const hours = Math.floor(avgMinutes / 60);
                  const mins = Math.round(avgMinutes % 60);
                  timeDisplay = `${hours}h ${mins}m`;
              }
          }

          return {
              key,
              label: DEPARTMENTS[key as keyof typeof DEPARTMENTS],
              topUser: data.topUser,
              topUserCount: data.maxCount,
              avgTime: timeDisplay,
              avgMinutes, // para ordenação de "Gargalo"
              currentLoad: sectorLoad[key as keyof typeof sectorLoad] || 0
          };
      });

      // Lead Time Médio (Global)
      let totalCycleTimeMs = 0;
      let countCycleTime = 0;
      filteredOrders.forEach(o => {
          if (o.isArchived && o.createdAt && o.archivedAt) {
              const start = new Date(o.createdAt).getTime();
              const end = new Date(o.archivedAt).getTime();
              const diff = end - start;
              if (diff > 0) {
                  totalCycleTimeMs += diff;
                  countCycleTime++;
              }
          }
      });
      const avgCycleTimeDays = countCycleTime > 0 ? (totalCycleTimeMs / countCycleTime / (1000 * 60 * 60 * 24)).toFixed(1) : '0.0';

      return {
          totalOrders,
          totalActive,
          totalArchived,
          totalRemakes,
          remakeRate: totalOrders > 0 ? ((totalRemakes / totalOrders) * 100).toFixed(1) : '0.0',
          vendorList,
          topClients,
          sectorPerformance,
          avgCycleTimeDays
      };
  }, [orders, reportStartDate, reportEndDate]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.cargo?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const allLogs = useMemo(() => {
    type CombinedLogEntry = {
        id?: string;
        userId: string;
        userName: string;
        timestamp: string;
        status: string; 
        sector: string;
        orderOr: string;
        orderCliente: string;
    };

    const logs: CombinedLogEntry[] = [];

    orders.forEach(order => {
      (order.history || []).forEach(h => {
        logs.push({ 
            userId: h.userId,
            userName: h.userName,
            timestamp: h.timestamp,
            status: h.status,
            sector: h.sector,
            orderOr: order.or, 
            orderCliente: order.cliente 
        });
      });
    });

    if (globalLogs && globalLogs.length > 0) {
        globalLogs.forEach(g => {
            let statusLabel = 'Ação Admin';
            if (g.actionType === 'DELETE_ORDER') statusLabel = 'Exclusão de O.R';
            else if (g.actionType === 'DELETE_USER') statusLabel = 'Exclusão Usuário';

            logs.push({
                userId: g.userId,
                userName: g.userName,
                timestamp: g.timestamp,
                status: statusLabel,
                sector: 'Geral', 
                orderOr: 'LOG', 
                orderCliente: g.targetInfo 
            });
        });
    }

    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [orders, globalLogs]);

  const filteredLogs = useMemo(() => {
    if (!logSearchTerm) return allLogs;
    const lowerTerm = logSearchTerm.toLowerCase();
    return allLogs.filter(log => 
      log.userName.toLowerCase().includes(lowerTerm) ||
      log.orderOr.toLowerCase().includes(lowerTerm) ||
      log.orderCliente.toLowerCase().includes(lowerTerm) ||
      log.status.toLowerCase().includes(lowerTerm)
    );
  }, [allLogs, logSearchTerm]);

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setPasswordValue(user.password || '');
    setShowPasswordText(false);
    setShowForm(true);
  };

  const handleNewUserClick = () => {
    setEditingUser(null);
    setPasswordValue(''); 
    setShowPasswordText(false);
    setShowForm(true);
  };

  const handleResetPasswordInForm = () => {
    setPasswordValue(DEFAULT_USER_PASS);
    showToast('Senha definida para "1234". Salve para aplicar.', 'info');
  };

  const handleSaveUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const finalPassword = passwordValue.trim() || DEFAULT_USER_PASS;

    const userData: Partial<User> = {
      nome: (formData.get('nome') as string).toUpperCase(),
      cargo: (formData.get('cargo') as string).toUpperCase(),
      role: formData.get('role') as UserRole,
      email: formData.get('email') as string,
      password: finalPassword,
      departamento: formData.get('departamento') as any,
    };
    if (editingUser) onUpdateUser({ ...editingUser, ...userData } as User);
    else onAddUser(userData);
    setShowForm(false);
    setEditingUser(null);
  };

  const handleSaveCompanySettings = () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setTimeout(() => {
      onUpdateCompanySettings(localSettings);
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 1500);
  };

  const handleAddRamal = () => {
    if (!newRamal.nome || !newRamal.numero) {
        showToast('Preencha Nome e Número.', 'error');
        return;
    }
    const ramal: Ramal = {
      id: Date.now().toString(),
      nome: newRamal.nome.toUpperCase(),
      numero: newRamal.numero,
      departamento: newRamal.departamento?.toUpperCase() || 'GERAL'
    };
    onUpdateRamais([...ramais, ramal]);
    setNewRamal({ nome: '', numero: '', departamento: '' });
    showToast('Ramal adicionado com sucesso', 'success');
  };

  const handleDeleteRamal = (id: string) => {
    onUpdateRamais(ramais.filter(r => r.id !== id));
  };

  const confirmDeleteUser = () => {
    if (deleteModal.userId) {
      onDeleteUser(deleteModal.userId);
      setDeleteModal({ isOpen: false, userId: null, userName: null });
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteModal({ isOpen: true, userId: id, userName: name });
  };

  const handleManualReset = (user: User) => {
    if (window.confirm(`Deseja resetar a senha de ${user.nome} para "1234"?`)) {
        onUpdateUser({ ...user, password: '1234' });
        showToast(`Senha de ${user.nome} redefinida com sucesso.`, 'success');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("A logo deve ter no máximo 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalSettings({ ...localSettings, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeData = () => {
    if (!startDate || !endDate) {
      alert("Por favor, selecione a Data Inicial e Final.");
      return;
    }
    if (startDate > endDate) {
      alert("A Data Inicial não pode ser maior que a Final.");
      return;
    }

    const items = orders.filter(o => 
      o.isArchived && 
      o.dataEntrega >= startDate && 
      o.dataEntrega <= endDate
    );

    if (items.length === 0) {
       showToast("Nenhum item finalizado/arquivado encontrado neste período.", "info");
    }

    setPreviewItems(items);
    setSecurityStep('IDLE');
    setInputToken('');
  };

  const handleClearAnalysis = () => {
    setPreviewItems(null);
    setStartDate('');
    setEndDate('');
    setSecurityStep('IDLE');
    setInputToken('');
  };

  const handlePrintSystemReport = () => {
      const w = window.open('', '_blank');
      if (!w) return;

      const logoImg = companySettings.logoUrl ? `<img src="${companySettings.logoUrl}" style="height:50px; width:auto; object-fit:contain;">` : '';
      
      const vendorRows = stats.vendorList.map((v, i) => `
        <tr>
            <td style="padding:8px; border-bottom:1px solid #eee;">#${i+1}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; font-weight:bold;">${v.name}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${v.total}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:center; color:#10b981;">${v.active}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:center; color:#f59e0b;">${v.remakes}</td>
        </tr>
      `).join('');

      const clientRows = stats.topClients.map((c, i) => `
        <tr>
            <td style="padding:8px; border-bottom:1px solid #eee;">#${i+1}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; font-weight:bold; text-transform:uppercase;">${c.name}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${c.count} Ordens</td>
        </tr>
      `).join('');

      const sectorRows = stats.sectorPerformance.map((s, i) => `
        <tr>
            <td style="padding:8px; border-bottom:1px solid #eee;">${s.label}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:center; font-weight:bold; color: #d97706;">${s.currentLoad}</td>
            <td style="padding:8px; border-bottom:1px solid #eee;"><strong>${s.topUser}</strong> (${s.topUserCount})</td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${s.avgTime}</td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Relatório Gerencial - ${companySettings.name}</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; color: #333; padding: 40px; }
                h1, h2, h3 { margin: 0; text-transform: uppercase; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 40px; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
                .card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; background: #f9f9f9; }
                .stat-num { font-size: 32px; font-weight: 900; color: #064e3b; margin-top: 10px; display: block; }
                .stat-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #666; letter-spacing: 1px; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th { text-align: left; padding: 8px; background: #eee; text-transform: uppercase; font-size: 10px; }
                .print-btn { display: block; padding: 10px 20px; background: #000; color: #fff; text-decoration: none; width: fit-content; margin: 20px auto; border-radius: 5px; font-weight: bold; }
                @media print { .print-btn { display: none; } body { padding: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div style="display:flex; gap:15px; align-items:center;">
                    ${logoImg}
                    <div>
                        <h1>${companySettings.name}</h1>
                        <p style="font-size:12px; font-weight:bold; color:#666;">RELATÓRIO GERENCIAL - PERÍODO: ${reportStartDate.split('-').reverse().join('/')} A ${reportEndDate.split('-').reverse().join('/')}</p>
                    </div>
                </div>
                <div style="text-align:right;">
                    <p style="font-size:10px; font-weight:bold;">DATA: ${new Date().toLocaleString('pt-BR')}</p>
                </div>
            </div>

            <h3 style="margin-bottom:15px; font-size:14px; color:#999; border-bottom:1px solid #ccc;">Indicadores Principais</h3>
            <div class="grid" style="grid-template-columns: repeat(4, 1fr);">
                <div class="card">
                    <span class="stat-label">Total Ordens (Itens)</span>
                    <span class="stat-num">${stats.totalOrders}</span>
                </div>
                <div class="card">
                    <span class="stat-label">Itens Arquivados</span>
                    <span class="stat-num">${stats.totalArchived}</span>
                </div>
                <div class="card">
                    <span class="stat-label">Taxa Refazimento</span>
                    <span class="stat-num" style="color: ${Number(stats.remakeRate) > 5 ? 'red' : 'orange'};">${stats.remakeRate}%</span>
                    <span style="font-size:10px; color:#999;">${stats.totalRemakes} itens refeitos</span>
                </div>
                <div class="card">
                    <span class="stat-label">Lead Time Médio</span>
                    <span class="stat-num">${stats.avgCycleTimeDays} <span style="font-size:12px;">dias</span></span>
                    <span style="font-size:10px; color:#999;">Criação até Arquivamento</span>
                </div>
            </div>

            <h3 style="margin-bottom:15px; font-size:14px; color:#999; border-bottom:1px solid #ccc; margin-top:20px;">Análise por Setor (Gargalos e Eficiência)</h3>
            <table style="margin-bottom:40px;">
                <thead>
                    <tr>
                        <th>Setor</th>
                        <th style="text-align:center;">Carga Atual (Itens Pendentes)</th>
                        <th>Top Operador (Qtd Finalizada)</th>
                        <th style="text-align:right;">Tempo Médio (Prod -> Conc)</th>
                    </tr>
                </thead>
                <tbody>
                    ${sectorRows}
                </tbody>
            </table>

            <div class="grid">
                <div>
                    <h3 style="margin-bottom:15px; font-size:14px; color:#999; border-bottom:1px solid #ccc;">Top 5 Vendedores</h3>
                    <table>
                        <thead>
                            <tr>
                                <th width="50">#</th>
                                <th>Vendedor</th>
                                <th style="text-align:center;">Total</th>
                                <th style="text-align:center;">Ativos</th>
                                <th style="text-align:center;">Refaz</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${vendorRows}
                        </tbody>
                    </table>
                </div>
                <div>
                    <h3 style="margin-bottom:15px; font-size:14px; color:#999; border-bottom:1px solid #ccc;">Top 5 Clientes</h3>
                    <table>
                        <thead>
                            <tr>
                                <th width="50">#</th>
                                <th>Cliente</th>
                                <th style="text-align:right;">Volume</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${clientRows}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style="margin-top:50px; text-align:center; font-size:10px; color:#999; border-top:1px solid #eee; padding-top:20px;">
                Relatório gerado automaticamente pelo sistema NEWCOM CONTROL.
            </div>

            <a href="#" onclick="window.print(); return false;" class="print-btn">IMPRIMIR RELATÓRIO</a>
        </body>
        </html>
      `;
      w.document.write(html);
      w.document.close();
  };

  const handleDownloadAndVerify = async () => {
    if (!previewItems || previewItems.length === 0) return;
    setIsGeneratingReport(true);
    
    // Geração do Token de Segurança
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedToken(token);
    
    setTimeout(() => {
        // --- GERAÇÃO DO HTML DO RELATÓRIO MODERNIZADO E AGRUPADO ---
        const logoImg = companySettings.logoUrl ? `<img src="${companySettings.logoUrl}" style="max-width:80px; max-height:80px; object-fit:contain;" />` : '';
        const today = new Date().toLocaleString('pt-BR');
        
        // 1. Agrupar Itens por OR
        type GroupedOrder = {
            or: string;
            cliente: string;
            vendedor: string;
            dataEntrega: string;
            items: Order[];
        };

        const groupedMap: Record<string, GroupedOrder> = {};
        previewItems.forEach(item => {
            if (!groupedMap[item.or]) {
                groupedMap[item.or] = {
                    or: item.or,
                    cliente: item.cliente,
                    vendedor: item.vendedor,
                    dataEntrega: item.dataEntrega,
                    items: []
                };
            }
            groupedMap[item.or].items.push(item);
        });

        const groupedList = Object.values(groupedMap).sort((a, b) => a.dataEntrega.localeCompare(b.dataEntrega));

        // 2. Gerar Lista Resumo (1 linha por OR)
        const summaryRows = groupedList.map((group, idx) => {
            const totalAttachments = group.items.reduce((acc, i) => acc + (i.attachments?.length || 0), 0);
            // Pega a data de arquivamento do primeiro item (assumindo que o grupo é arquivado junto)
            const archiveDate = group.items[0].archivedAt ? new Date(group.items[0].archivedAt).toLocaleDateString('pt-BR') : '-';

            return `
            <tr>
                <td style="padding:12px; text-align:center; font-weight:bold; color:#64748b; border-top: 1px solid #f1f5f9;">#${idx + 1}</td>
                <td style="padding:12px; font-weight:900; font-size:13px; border-top: 1px solid #f1f5f9;">${group.or}</td>
                <td style="padding:12px; border-top: 1px solid #f1f5f9; text-transform: uppercase; font-weight:600;">${group.cliente}</td>
                <td style="padding:12px; border-top: 1px solid #f1f5f9; text-transform: uppercase; font-size:11px;">${group.vendedor}</td>
                <td style="padding:12px; text-align:center; border-top: 1px solid #f1f5f9;"><span style="background:#f1f5f9; padding:4px 8px; border-radius:6px; font-weight:bold; font-size:11px;">${group.items.length} Itens</span></td>
                <td style="padding:12px; text-align:center; border-top: 1px solid #f1f5f9;">
                    ${totalAttachments > 0 ? `<span style="font-size:10px;">📎 ${totalAttachments}</span>` : '<span style="color:#cbd5e1;">-</span>'}
                </td>
                <td style="padding:12px; text-align:right; border-top: 1px solid #f1f5f9; font-weight:bold;">${group.dataEntrega.split('-').reverse().join('/')}</td>
                <td style="padding:12px; text-align:right; border-top: 1px solid #f1f5f9; font-size:11px; color:#64748b;">${archiveDate}</td>
            </tr>
        `}).join('');

        // 3. Gerar Seção Detalhada (1 Card por OR, listando itens dentro)
        const detailedSections = groupedList.map((group, idx) => {
            
            // Gerar linhas de itens dentro desta ordem
            const itemDetailsHtml = group.items.sort((a,b) => (a.numeroItem || '').localeCompare(b.numeroItem || '')).map(item => {
                
                const attachCount = item.attachments?.length || 0;
                const itemArchived = item.archivedAt ? new Date(item.archivedAt).toLocaleString('pt-BR') : '-';

                // HIGHLIGHT REFAZIMENTO NO RELATÓRIO
                const bgStyle = item.isRemake ? 'background:#fff7ed; border-left: 4px solid #f97316;' : 'background:#f8fafc; border-left: 1px solid #e2e8f0;';
                const remakeBadge = item.isRemake ? '<span style="background:#f97316; color:white; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:900; margin-left:8px;">⚠️ REFAZIMENTO</span>' : '';

                // Histórico deste item específico
                const historyRows = (item.history || []).map(h => `
                    <tr>
                        <td style="color:#64748b; padding:4px 0; width: 120px;">${new Date(h.timestamp).toLocaleString('pt-BR')}</td>
                        <td style="font-weight:600; padding:4px 0;">${h.userName}</td>
                        <td style="padding:4px 0;">${h.sector}</td>
                        <td style="padding:4px 0; text-align:right;"><span style="background:#fff; border:1px solid #e2e8f0; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:9px; text-transform:uppercase;">${h.status}</span></td>
                    </tr>
                `).join('');

                return `
                    <div style="${bgStyle} border-right:1px solid #e2e8f0; border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; border-radius:4px; padding:15px; margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                            <div>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    ${item.numeroItem ? `<span style="background:#0f172a; color:white; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">REF: ${item.numeroItem}</span>` : ''}
                                    <span style="font-size:12px; font-weight:bold; text-transform:uppercase;">${item.item}</span>
                                    ${remakeBadge}
                                </div>
                                <div style="margin-top:6px; font-size:10px; color:#64748b; display:flex; gap:15px;">
                                    <span><strong>Vendedor:</strong> ${item.vendedor}</span>
                                    <span><strong>Arquivado em:</strong> ${itemArchived}</span>
                                    <span><strong>Anexos:</strong> ${attachCount > 0 ? `Sim (${attachCount})` : 'Não'}</span>
                                </div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:9px; font-weight:bold; color:#94a3b8; text-transform:uppercase;">Quantidade</div>
                                <div style="font-size:14px; font-weight:900; color:#0f172a;">${item.quantidade || '1'}</div>
                            </div>
                        </div>
                        
                        <div style="border-top:1px dashed #cbd5e1; padding-top:8px;">
                            <div style="font-size:9px; font-weight:bold; color:#94a3b8; margin-bottom:4px; text-transform:uppercase;">Rastreabilidade do Item</div>
                            <table style="width:100%; font-size:10px; border-collapse:collapse;">
                                ${historyRows || '<tr><td colspan="4" style="color:#94a3b8; font-style:italic;">Sem registro.</td></tr>'}
                            </table>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="order-group-card" style="page-break-inside:avoid; margin-bottom: 30px; border:1px solid #cbd5e1; border-radius:16px; overflow:hidden;">
                    <div class="group-header" style="background:#0f172a; color:white; padding:12px 20px; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="background:#fff; color:#0f172a; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:11px;">#${idx + 1}</span>
                            <span style="font-size:16px; font-weight:900;">O.R ${group.or}</span>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:9px; font-weight:bold; opacity:0.7;">CLIENTE</div>
                            <div style="font-size:11px; font-weight:bold;">${group.cliente}</div>
                        </div>
                    </div>
                    <div style="padding:15px; background:#fff;">
                       <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:11px; font-weight:bold; color:#64748b; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                           <span>DATA ENTREGA: ${group.dataEntrega.split('-').reverse().join('/')}</span>
                           <span>TOTAL DE ITENS: ${group.items.length}</span>
                       </div>
                       ${itemDetailsHtml}
                    </div>
                </div>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório de Limpeza - ${new Date().toISOString().split('T')[0]}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; margin: 0; padding: 40px; background: #fff; }
                    .report-container { max-width: 1000px; margin: 0 auto; }
                    
                    .header { 
                        display: flex; justify-content: space-between; align-items: center; 
                        background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; 
                        padding: 24px; margin-bottom: 30px; 
                    }
                    .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; color: #0f172a; letter-spacing: -0.5px; }
                    
                    .token-box { 
                        border: 2px dashed #fecaca; background: #fef2f2; 
                        border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 40px; 
                    }
                    .token-code { font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #dc2626; margin: 8px 0; }

                    .section-title { font-size: 14px; font-weight: 900; text-transform: uppercase; color: #94a3b8; margin-bottom: 15px; letter-spacing: 1px; padding-left: 5px; }

                    table.summary-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 40px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; font-size: 11px; }
                    table.summary-table th { background: #f1f5f9; text-transform: uppercase; font-size: 10px; font-weight: 800; color: #475569; padding: 12px; text-align: left; }
                    table.summary-table td { color: #334155; }
                    table.summary-table tr:last-child td { border-bottom: none; }

                    .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
                </style>
            </head>
            <body>
                <div class="report-container">
                    <div class="header">
                        <div>${logoImg}</div>
                        <div style="text-align:right;">
                            <h1>${companySettings.name}</h1>
                            <p>RELATÓRIO DE ARQUIVAMENTO E LIMPEZA</p>
                            <p style="margin-top:2px; font-size:10px; opacity:0.7;">Gerado em: ${today}</p>
                        </div>
                    </div>

                    <div class="token-box">
                        <p style="margin:0; font-weight:bold; color:#ef4444; font-size:12px; text-transform:uppercase; letter-spacing:1px;">Token de Segurança para Exclusão</p>
                        <div class="token-code">${token}</div>
                        <p style="margin:5px 0 0 0; font-size:11px; color:#7f1d1d;">Use este código para confirmar a exclusão permanente no sistema.</p>
                    </div>

                    <div class="section-title">Resumo por Ordem de Serviço (${groupedList.length} Ordens)</div>
                    <table class="summary-table">
                        <thead>
                            <tr>
                                <th style="text-align:center; width: 40px;">#</th>
                                <th>O.R</th>
                                <th>Cliente</th>
                                <th>Vendedor</th>
                                <th style="text-align:center;">Qtd Itens</th>
                                <th style="text-align:center;">Anexos</th>
                                <th style="text-align:right;">Entrega</th>
                                <th style="text-align:right;">Arquivado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${summaryRows}
                        </tbody>
                    </table>

                    <div style="page-break-before: always;"></div>
                    <div class="section-title">Detalhamento Técnico</div>
                    ${detailedSections}

                    <div class="footer">
                        Documento gerado pelo sistema NEWCOM CONTROL. A exclusão destes dados é irreversível após confirmação via token.<br/>
                        Newcom Control Systems © ${new Date().getFullYear()}
                    </div>
                </div>
                
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;

        // Create Blob and Trigger Download
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `RELATORIO_LIMPEZA_${new Date().toISOString().slice(0,10)}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setIsGeneratingReport(false);
        setSecurityStep('VERIFYING');
        showToast('Relatório gerado. Digite o token para confirmar exclusão.', 'info');
    }, 1500);
  };

  const handleFinalizeDeletion = () => {
    if (inputToken !== generatedToken) {
        showToast("Código de segurança incorreto.", "error");
        return;
    }
    if (!previewItems) return;
    const idsToDelete = previewItems.map(o => o.id);
    if (onBulkDeleteOrders) {
        onBulkDeleteOrders(idsToDelete);
        handleClearAnalysis();
        showToast("Limpeza concluída com sucesso.", "success");
    }
  };

  const TabButton = ({ id, label }: { id: typeof activeTab, label: string }) => (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`relative flex-1 md:flex-none px-3 md:px-6 py-4 text-[9px] md:text-[10px] font-black uppercase tracking-[0.5px] md:tracking-[2px] transition-all whitespace-nowrap shrink-0 border-b-2 md:border-b-0 rounded-lg md:rounded-none
        ${activeTab === id ? 'text-emerald-700 dark:text-emerald-400 border-emerald-500 bg-emerald-50 md:bg-transparent dark:bg-emerald-900/20 md:dark:bg-transparent' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 border-transparent'}
      `}
    >
      {label}
      {activeTab === id && (
        <div className="hidden md:block absolute bottom-0 left-0 w-full h-[3px] bg-emerald-500 rounded-t-full"></div>
      )}
    </button>
  );

  return (
    <>
      <div className="fixed inset-0 z-[500] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-md p-0 md:p-4 animate-in fade-in">
        <div className="bg-[#f8fafc] dark:bg-slate-950 rounded-none md:rounded-[40px] shadow-4xl w-full h-full md:max-w-6xl md:h-[90vh] flex flex-col overflow-hidden border-none md:border border-white dark:border-slate-800">
          
          <div className="px-4 py-4 md:px-10 md:pt-8 md:pb-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4 md:gap-6 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 md:gap-6">
                <div className="w-10 h-10 md:w-14 md:h-14 bg-[#064e3b] dark:bg-emerald-900 rounded-xl md:rounded-2xl flex items-center justify-center shadow-xl overflow-hidden shrink-0">
                  {localSettings.logoUrl ? (
                    <img src={localSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-6 h-6 md:w-8 md:h-8 text-emerald-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L4 7L12 12L20 7L12 2Z" fill="currentColor" fillOpacity="0.4"/>
                        <path d="M12 12L4 17L12 22L20 17L12 12Z" fill="currentColor" fillOpacity="0.2"/>
                        <path d="M4 7V17L12 12L4 7Z" fill="currentColor" fillOpacity="0.7"/>
                        <path d="M20 7V17L12 12L20 7Z" fill="currentColor"/>
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Painel Admin</h3>
                  <p className="text-[8px] md:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5 md:mt-1">Gestão Centralizada</p>
                </div>
              </div>

              <button onClick={onClose} className="p-2 md:p-3 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 md:flex-nowrap md:overflow-x-auto md:custom-scrollbar md:-mx-4 md:px-4">
              <TabButton id="USUÁRIOS" label="Colaboradores" />
              <TabButton id="LOGS" label="Auditoria" />
              <TabButton id="RELATÓRIOS" label="Relatórios" />
              <TabButton id="RAMAIS" label="Ramais" />
              <TabButton id="CONFIGURAÇÕES" label="Empresa" />
              <TabButton id="MANUTENÇÃO" label="Manutenção" />
            </div>
          </div>

          <div className="flex-1 p-4 md:p-10 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-slate-900/50">
            {activeTab === 'USUÁRIOS' ? (
              <>
                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center mb-6 bg-white dark:bg-slate-900 p-3 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm gap-3">
                  <div className="relative flex-1 max-w-full md:max-w-md">
                    <input 
                      type="text" 
                      placeholder="Buscar colaborador..." 
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-[11px] font-bold dark:text-white focus:ring-2 ring-emerald-500 outline-none transition-all"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5"/></svg>
                  </div>
                  <button 
                    onClick={handleNewUserClick}
                    className="px-6 py-2.5 bg-[#064e3b] dark:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 hover:bg-emerald-900 dark:hover:bg-emerald-600 active:scale-95 transition-all whitespace-nowrap"
                  >
                    Novo Colaborador
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredUsers.map(user => (
                    <div key={user.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <div className="w-10 h-10 bg-slate-900 dark:bg-slate-800 text-emerald-400 rounded-xl flex items-center justify-center text-lg font-black shadow-inner uppercase shrink-0">{user.nome[0]}</div>
                          <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${user.role === 'Admin' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                            {user.role}
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase truncate leading-tight mb-0.5" title={user.nome}>{user.nome}</h4>
                        <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 truncate">{user.cargo || 'CARGO NÃO DEFINIDO'}</p>
                        
                        <div className="flex items-center gap-1 mb-4">
                          <span className="text-[8px] font-bold text-slate-400 uppercase">Senha:</span>
                          <div className="flex gap-0.5">
                              {Array.from({ length: Math.min(user.password?.length || 4, 8) }).map((_, i) => (
                                <div key={i} className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                              ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-3 border-t border-slate-50 dark:border-slate-800">
                        <button onClick={() => handleEditClick(user)} className="flex-1 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all">Editar</button>
                        <button onClick={() => handleDeleteClick(user.id, user.nome)} className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all shadow-sm"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2.5"/></svg></button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : activeTab === 'LOGS' ? (
              <div className="flex flex-col gap-4 h-full">
                <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center shrink-0">
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      placeholder="Filtrar logs..." 
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[11px] font-bold dark:text-white focus:ring-2 ring-emerald-500 outline-none transition-all"
                      value={logSearchTerm}
                      onChange={e => setLogSearchTerm(e.target.value)}
                    />
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5"/></svg>
                  </div>
                </div>
                
                {/* --- MOBILE VIEW: LOG CARDS --- */}
                <div className="md:hidden space-y-2 pb-20">
                    {filteredLogs.map((log, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 p-3 rounded-xl border-l-4 border-l-slate-300 border border-r-slate-200 border-y-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1 relative overflow-hidden" style={{ borderLeftColor: log.status === 'Concluído' ? '#10b981' : log.status === 'Em Produção' ? '#f59e0b' : '#cbd5e1' }}>
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase">{log.userName}</span>
                                <span className="text-[9px] font-bold text-slate-400 tabular-nums">{new Date(log.timestamp).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
                                    {log.orderOr === 'LOG' ? 'SISTEMA' : `O.R ${log.orderOr}`}
                                </span>
                                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 truncate">{log.orderCliente}</span>
                            </div>
                            <div className="mt-1">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                    log.status === 'Concluído' ? 'bg-emerald-100 text-emerald-700' : 
                                    log.status === 'Em Produção' ? 'bg-amber-100 text-amber-700' : 
                                    'bg-slate-100 text-slate-500'
                                }`}>
                                    {log.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* --- DESKTOP VIEW: TABLE --- */}
                <div className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm flex-1 relative">
                  <div className="absolute inset-0 overflow-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                        <tr>
                            <th className="px-4 md:px-6 py-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">Data</th>
                            <th className="px-4 md:px-6 py-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">User</th>
                            <th className="px-4 md:px-6 py-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">Info</th>
                            <th className="px-4 md:px-6 py-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right whitespace-nowrap">Status</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {filteredLogs.map((log, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                            <td className="px-4 md:px-6 py-3 whitespace-nowrap"><span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">{new Date(log.timestamp).toLocaleString('pt-BR')}</span></td>
                            <td className="px-4 md:px-6 py-3 whitespace-nowrap"><span className="text-[10px] font-black text-slate-900 dark:text-white uppercase leading-none">{log.userName}</span></td>
                            <td className="px-4 md:px-6 py-3 min-w-[150px]">
                                <div className="flex flex-col">
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
                                    {log.orderOr === 'LOG' ? 'REGISTRO DE SISTEMA' : `O.R ${log.orderOr}`}
                                </span>
                                <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate max-w-[200px] leading-tight">{log.orderCliente}</span>
                                </div>
                            </td>
                            <td className="px-4 md:px-6 py-3 text-right whitespace-nowrap">
                                <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                log.status === 'Concluído' ? 'bg-emerald-100 text-emerald-700' : 
                                log.status === 'Em Produção' ? 'bg-amber-100 text-amber-700' : 
                                'bg-slate-100 text-slate-500'
                                }`}>
                                {log.status}
                                </span>
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : activeTab === 'RELATÓRIOS' ? (
                <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in h-full flex flex-col">
                    
                    {/* Header de Filtro do Relatório */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-end md:items-center justify-between shrink-0">
                        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                            <div className="space-y-1 w-full md:w-40">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Início</label>
                                <input 
                                    type="date"
                                    value={reportStartDate}
                                    onChange={e => setReportStartDate(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-white outline-none focus:ring-2 ring-emerald-500"
                                />
                            </div>
                            <div className="space-y-1 w-full md:w-40">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Fim</label>
                                <input 
                                    type="date"
                                    value={reportEndDate}
                                    onChange={e => setReportEndDate(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-white outline-none focus:ring-2 ring-emerald-500"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase hidden md:block">Analíticos Gerenciais</span>
                            <button 
                                onClick={handlePrintSystemReport}
                                className="px-6 py-2.5 bg-slate-900 dark:bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-700 dark:hover:bg-emerald-500 transition-all flex items-center gap-2 active:scale-95"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeWidth="2.5"/></svg>
                                Imprimir
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total no Período</span>
                                <span className="block text-3xl font-[950] text-slate-900 dark:text-white mt-1 tabular-nums">{stats.totalOrders}</span>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{stats.totalActive} Ativos</span>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Refazimentos</span>
                                <span className="block text-3xl font-[950] text-orange-500 mt-1 tabular-nums">{stats.totalRemakes}</span>
                                <span className="text-[8px] font-bold text-slate-400 mt-1 block">Taxa: {stats.remakeRate}%</span>
                            </div>
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lead Time Global</span>
                                <span className="block text-3xl font-[950] text-blue-500 mt-1 tabular-nums">{stats.avgCycleTimeDays} <span className="text-sm font-bold text-slate-400">dias</span></span>
                                <span className="text-[8px] font-bold text-slate-400 mt-1 block">Criação até Arquivamento</span>
                            </div>
                            {/* Sugestão de Ideia: Gargalos */}
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm border-l-4 border-l-red-400">
                                <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Gargalo Potencial</span>
                                {(() => {
                                    const slowest = [...stats.sectorPerformance].sort((a,b) => b.avgMinutes - a.avgMinutes)[0];
                                    return slowest && slowest.avgMinutes > 0 ? (
                                        <>
                                            <span className="block text-xl font-[950] text-slate-800 dark:text-white mt-1 leading-tight">{slowest.label.split('&')[0]}</span>
                                            <span className="text-[9px] font-bold text-slate-400 mt-1 block">Média: {slowest.avgTime}</span>
                                        </>
                                    ) : (
                                        <span className="block text-sm font-bold text-slate-400 mt-2">Sem dados suficientes</span>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Ranking Vendedores */}
                            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-6">
                                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">Volume por Vendedor</h4>
                                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                    {stats.vendorList.map((v, idx) => (
                                        <div key={v.name} className="flex items-center gap-3">
                                            <span className="w-5 text-[10px] font-black text-slate-300 tabular-nums">#{idx + 1}</span>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">{v.name}</span>
                                                    <span className="text-[10px] font-bold text-slate-900 dark:text-white tabular-nums">{v.total}</span>
                                                </div>
                                                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                                    <div style={{ width: `${(v.active / v.total) * 100}%` }} className="bg-emerald-500 h-full"></div>
                                                    <div style={{ width: `${(v.remakes / v.total) * 100}%` }} className="bg-orange-400 h-full"></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Ranking Clientes */}
                            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-6">
                                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">Top 5 Clientes</h4>
                                <div className="space-y-4">
                                    {stats.topClients.map((c, idx) => (
                                        <div key={c.name} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">{idx + 1}</div>
                                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase truncate">{c.name}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded tabular-nums">{c.count} Ordens</span>
                                        </div>
                                    ))}
                                    {stats.topClients.length === 0 && <p className="text-[10px] text-slate-400 text-center py-4">Sem dados no período.</p>}
                                </div>
                            </div>
                        </div>

                        {/* Produtividade por Setor */}
                        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-6">
                            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">Produtividade & Tempos por Setor</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <th className="pb-3 text-[9px] font-black text-slate-400 uppercase tracking-wider">Setor</th>
                                            <th className="pb-3 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">Carga Atual</th>
                                            <th className="pb-3 text-[9px] font-black text-slate-400 uppercase tracking-wider">Maior Executor</th>
                                            <th className="pb-3 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right">Tempo Médio</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {stats.sectorPerformance.map((s) => (
                                            <tr key={s.key} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="py-3 text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">{s.label}</td>
                                                <td className="py-3 text-[10px] font-black text-amber-500 dark:text-amber-400 text-center tabular-nums">{s.currentLoad}</td>
                                                <td className="py-3 text-[10px] font-black text-slate-900 dark:text-white uppercase">{s.topUser}</td>
                                                <td className="py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 text-right tabular-nums">{s.avgTime}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'RAMAIS' ? (
              <div className="max-w-3xl mx-auto space-y-4 md:space-y-8 animate-in slide-in-from-bottom-8 duration-500 pb-10">
                <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-lg">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-4 tracking-widest">Adicionar Novo Ramal</h4>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3">
                      <input 
                          type="text" 
                          placeholder="NOME / SETOR" 
                          className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 ring-emerald-500 dark:text-white"
                          value={newRamal.nome}
                          onChange={e => setNewRamal({...newRamal, nome: e.target.value.toUpperCase()})}
                      />
                      <input 
                          type="text" 
                          placeholder="NÚMERO / RAMAL" 
                          className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 ring-emerald-500 dark:text-white"
                          value={newRamal.numero}
                          onChange={e => setNewRamal({...newRamal, numero: e.target.value})}
                      />
                      <input 
                          type="text" 
                          placeholder="DEPTO (OPCIONAL)" 
                          className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 ring-emerald-500 dark:text-white"
                          value={newRamal.departamento}
                          onChange={e => setNewRamal({...newRamal, departamento: e.target.value.toUpperCase()})}
                      />
                      <button 
                          onClick={handleAddRamal}
                          className="px-6 py-3 md:py-0 bg-[#064e3b] dark:bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 transition-all shadow-sm flex items-center justify-center uppercase font-black text-[10px] tracking-widest"
                      >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="3"/></svg>
                      </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ramais.map(ramal => (
                      <div key={ramal.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center group hover:shadow-md transition-all">
                          <div>
                            <p className="text-xs font-black text-slate-900 dark:text-white uppercase">{ramal.nome}</p>
                            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{ramal.departamento || 'GERAL'}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{ramal.numero}</span>
                            <button 
                                onClick={() => handleDeleteRamal(ramal.id)}
                                className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all md:opacity-0 group-hover:opacity-100"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2.5"/></svg>
                            </button>
                          </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : activeTab === 'CONFIGURAÇÕES' ? (
              <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 animate-in slide-in-from-bottom-8 duration-500 pb-10">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-lg">
                    <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Dados da Empresa</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Nome Fantasia</label>
                            <input 
                                type="text" 
                                value={localSettings.name}
                                onChange={e => setLocalSettings({...localSettings, name: e.target.value.toUpperCase()})}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-xl text-xs font-bold uppercase outline-none focus:ring-1 ring-emerald-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Contato</label>
                            <input 
                                type="text" 
                                value={localSettings.contact}
                                onChange={e => setLocalSettings({...localSettings, contact: e.target.value})}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-xl text-xs font-bold outline-none focus:ring-1 ring-emerald-500"
                            />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Endereço Completo</label>
                            <input 
                                type="text" 
                                value={localSettings.address}
                                onChange={e => setLocalSettings({...localSettings, address: e.target.value})}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-xl text-xs font-bold outline-none focus:ring-1 ring-emerald-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Logo Compacto */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-lg flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase block">Logo Marca</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Visível em relatórios e etiquetas</span>
                        </div>
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:border-emerald-500 transition-colors overflow-hidden"
                        >
                            {localSettings.logoUrl ? (
                                <img src={localSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[8px] font-black text-slate-300">ADD</span>
                            )}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </div>

                    {/* Lembretes Compacto */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-lg">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase">Alertas de Prazo</span>
                            <button 
                              onClick={() => setLocalSettings({...localSettings, reminderEnabled: !localSettings.reminderEnabled})}
                              className={`w-8 h-4 rounded-full transition-colors relative ${localSettings.reminderEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                            >
                              <div className={`w-2.5 h-2.5 bg-white rounded-full absolute top-0.5 transition-transform ${localSettings.reminderEnabled ? 'left-5' : 'left-0.5'}`}></div>
                            </button>
                        </div>
                        <div className={`grid grid-cols-2 gap-3 ${!localSettings.reminderEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-center">
                                <span className="text-[7px] font-bold text-slate-400 uppercase block">Instalação</span>
                                <input 
                                    type="number" 
                                    value={localSettings.reminderInstallationDays || 1}
                                    onChange={e => setLocalSettings({...localSettings, reminderInstallationDays: parseInt(e.target.value) || 1})}
                                    className="w-full bg-transparent text-center font-black text-emerald-600 dark:text-emerald-400 outline-none"
                                />
                                <span className="text-[7px] font-bold text-slate-400 uppercase">Dias Antes</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-center">
                                <span className="text-[7px] font-bold text-slate-400 uppercase block">Expedição</span>
                                <input 
                                    type="number" 
                                    value={localSettings.reminderShippingDays || 1}
                                    onChange={e => setLocalSettings({...localSettings, reminderShippingDays: parseInt(e.target.value) || 1})}
                                    className="w-full bg-transparent text-center font-black text-emerald-600 dark:text-emerald-400 outline-none"
                                />
                                <span className="text-[7px] font-bold text-slate-400 uppercase">Dias Antes</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center pt-4">
                  <button 
                    onClick={handleSaveCompanySettings}
                    disabled={isSaving}
                    className={`px-12 py-3 rounded-2xl font-black uppercase tracking-[2px] text-[10px] shadow-lg transition-all active:scale-95 flex items-center gap-2 ${isSaving ? 'bg-slate-400 cursor-not-allowed text-white' : saveSuccess ? 'bg-emerald-500 text-white' : 'bg-slate-900 dark:bg-emerald-700 text-white hover:bg-emerald-600'}`}
                  >
                    {isSaving ? 'Salvando...' : saveSuccess ? 'Salvo!' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            ) : (
                // ... (MANUTENÇÃO tab content) ...
                <div className="max-w-4xl mx-auto space-y-4 animate-in slide-in-from-bottom-8 duration-500 h-full flex flex-col pb-20">
                  <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col h-full">
                      
                      <div className="text-center mb-4 shrink-0">
                          <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Limpeza e Arquivamento</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Selecione o período (Apenas Finalizados/Arquivados)</p>
                      </div>

                      <div className="flex flex-col md:flex-row items-end justify-center gap-2 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shrink-0">
                          <div className="flex flex-col gap-1 w-full md:w-40">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-2">Data Inicial</label>
                            <input 
                                  type="date" 
                                  style={{ colorScheme: 'light' }}
                                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-700 outline-none focus:ring-2 ring-emerald-500 bg-white w-full"
                                  value={startDate}
                                  onChange={(e) => setStartDate(e.target.value)}
                                  disabled={securityStep === 'VERIFYING'}
                            />
                          </div>
                          <div className="flex flex-col gap-1 w-full md:w-40">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-2">Data Final</label>
                            <input 
                                  type="date" 
                                  style={{ colorScheme: 'light' }}
                                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-700 outline-none focus:ring-2 ring-emerald-500 bg-white w-full"
                                  value={endDate}
                                  onChange={(e) => setEndDate(e.target.value)}
                                  disabled={securityStep === 'VERIFYING'}
                            />
                          </div>
                          
                          {securityStep === 'IDLE' && (
                              <button 
                                onClick={handleAnalyzeData}
                                className="w-full md:w-auto px-4 py-2 bg-slate-900 dark:bg-emerald-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 transition-all shadow-lg active:scale-95 h-[34px]"
                              >
                                Analisar
                              </button>
                          )}
                      </div>

                      {previewItems !== null && (
                        <div className="mt-4 flex-1 flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                            <div className="bg-slate-100 dark:bg-slate-800 px-4 md:px-6 py-3 flex justify-between items-center border-b border-slate-200 dark:border-slate-700 shrink-0">
                              <h5 className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                                  Encontrados: <span className="text-emerald-600 dark:text-emerald-400">{previewItems.length}</span>
                              </h5>
                              <button onClick={handleClearAnalysis} className="text-[9px] font-bold text-slate-400 hover:text-red-500 uppercase">
                                  {securityStep === 'VERIFYING' ? 'Cancelar' : 'Limpar'}
                              </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50 p-2 custom-scrollbar">
                              {previewItems.length === 0 ? (
                                  <div className="h-full flex items-center justify-center text-slate-400 text-[10px] font-bold uppercase">Nenhum registro encontrado.</div>
                              ) : (
                                  <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm z-10">
                                        <tr>
                                          <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">O.R</th>
                                          <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                                          <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Data</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                        {previewItems.map(item => (
                                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                              <td className="px-4 py-2 text-[10px] font-black text-emerald-600 dark:text-emerald-400">#{item.or}</td>
                                              <td className="px-4 py-2 text-[9px] font-bold text-slate-600 dark:text-slate-300 truncate max-w-[150px] md:max-w-[200px]">{item.cliente}</td>
                                              <td className="px-4 py-2 text-[9px] font-bold text-slate-400 text-right tabular-nums">{item.dataEntrega.split('-').reverse().join('/')}</td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                              )}
                            </div>

                            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                              {previewItems.length > 0 && securityStep === 'IDLE' && (
                                  <button 
                                      onClick={handleDownloadAndVerify}
                                      disabled={isGeneratingReport}
                                      className={`w-full md:w-auto px-6 py-3 rounded-xl font-black uppercase tracking-[1px] text-[9px] shadow-lg transition-all flex items-center justify-center gap-2
                                          ${isGeneratingReport ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white border border-amber-200'}
                                      `}
                                  >
                                      {isGeneratingReport ? (
                                          <>Gerando...</>
                                      ) : (
                                          <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2.5"/></svg>
                                            Baixar Relatório e Excluir
                                          </>
                                      )}
                                  </button>
                              )}
                            </div>
                        </div>
                      )}
                  </div>
              </div>
            )}
          </div>
        </div>

        {/* ... (Existing Edit User & Delete User Modals) ... */}
        {(showForm || editingUser) && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-in zoom-in-95 duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-[48px] p-12 w-full max-w-xl shadow-4xl border border-white dark:border-slate-800">
              {/* ... (Existing form logic) ... */}
              <div className="text-center mb-10">
                <h4 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-2">
                  {editingUser ? 'Ajustar Perfil' : 'Novo Colaborador'}
                </h4>
              </div>
              <form onSubmit={handleSaveUser} className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <input name="nome" defaultValue={editingUser?.nome} required className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-800 dark:text-white border-none rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 ring-emerald-500 transition-all" placeholder="NOME COMPLETO" />
                  <div className="grid grid-cols-2 gap-4">
                    <select name="role" defaultValue={editingUser?.role || 'Operador'} className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-800 dark:text-white border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 ring-emerald-500 transition-all cursor-pointer">
                      <option value="Admin">Administrador</option>
                      <option value="Operador">Operador</option>
                    </select>
                    <select name="departamento" defaultValue={editingUser?.departamento || 'preImpressao'} className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-800 dark:text-white border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 ring-emerald-500 transition-all cursor-pointer">
                      <option value="Geral">Todos os Setores</option>
                      {Object.entries(DEPARTMENTS).map(([k, v]) => <option key={k} value={k}>{v.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <input name="email" defaultValue={editingUser?.email} required className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-800 dark:text-white border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 ring-emerald-500 transition-all" placeholder="ID DE LOGIN (E-MAIL)" />
                  <div className="grid grid-cols-2 gap-4">
                    <input name="cargo" defaultValue={editingUser?.cargo} required className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-800 dark:text-white border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 ring-emerald-500 transition-all" placeholder="CARGO NA PLANTA" />
                    <div className="flex gap-2 relative">
                        <input 
                            name="password" 
                            type={showPasswordText ? "text" : "password"}
                            placeholder="SENHA" 
                            value={passwordValue}
                            onChange={(e) => setPasswordValue(e.target.value)} 
                            className="w-full pl-6 pr-10 py-4 bg-slate-100 dark:bg-slate-800 dark:text-white border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 ring-emerald-500 transition-all" 
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPasswordText(!showPasswordText)}
                          className="absolute right-[80px] md:right-[90px] top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-2"
                        >
                           {showPasswordText ? (
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" strokeWidth="2"/></svg>
                           ) : (
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth="2"/></svg>
                           )}
                        </button>
                        <button 
                            type="button" 
                            onClick={handleResetPasswordInForm}
                            className="px-3 bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white rounded-2xl text-[8px] font-black uppercase transition-all flex flex-col items-center justify-center leading-none shrink-0 w-[70px] md:w-[80px]"
                        >
                            <span>RESET</span>
                            <span>1234</span>
                        </button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-8">
                  <button type="button" onClick={() => { setShowForm(false); setEditingUser(null); }} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-red-500 transition-colors">Cancelar</button>
                  <button type="submit" className="flex-[2] py-4 bg-[#064e3b] dark:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-950/20 hover:bg-emerald-900 dark:hover:bg-emerald-600 transition-all active:scale-95">Confirmar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-[700] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-in zoom-in-95 duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] p-10 w-full max-w-md shadow-4xl border border-red-100 dark:border-red-900 flex flex-col items-center text-center">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-3">Excluir Colaborador?</h3>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed mb-8">
                Você está removendo <span className="text-slate-900 dark:text-white">{deleteModal.userName}</span> permanentemente.<br/>
              </p>
              <div className="flex gap-4 w-full">
                <button onClick={() => setDeleteModal({ isOpen: false, userId: null, userName: null })} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest rounded-2xl">Cancelar</button>
                <button onClick={confirmDeleteUser} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-red-600">Confirmar</button>
              </div>
            </div>
          </div>
        )}

        {securityStep === 'VERIFYING' && (
            <div className="fixed inset-0 z-[700] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
                <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 w-full max-w-sm shadow-2xl flex flex-col items-center text-center border-4 border-slate-100 dark:border-slate-800">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Confirmação de Segurança</h3>
                    <input 
                        type="text" 
                        placeholder="000000"
                        maxLength={6}
                        value={inputToken}
                        onChange={(e) => setInputToken(e.target.value.replace(/\D/g,''))}
                        className="w-full text-center text-4xl font-black tracking-[12px] border-b-4 border-slate-200 dark:border-slate-700 focus:border-red-500 outline-none py-4 text-slate-800 dark:text-white bg-transparent transition-all placeholder:text-slate-200 dark:placeholder:text-slate-700 mb-6"
                        autoFocus
                    />
                    <button onClick={handleFinalizeDeletion} disabled={inputToken.length !== 6} className="w-full py-4 bg-red-500 text-white rounded-xl font-black uppercase text-[11px] tracking-[2px] mb-3">Confirmar</button>
                    <button onClick={() => { setSecurityStep('IDLE'); setInputToken(''); }} className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cancelar</button>
                </div>
            </div>
        )}
      </div>
    </>
  );
};

export default UserManagementModal;
