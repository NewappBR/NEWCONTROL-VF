
import { Order, User } from './types';

export const DEFAULT_ADMIN_LOGIN = 'adm';
export const DEFAULT_ADMIN_PASS = '@dm123';
export const DEFAULT_USER_PASS = '1234';

export const STATUS_COLORS = {
  'Pendente': 'bg-slate-100 text-slate-500 border-slate-200',
  'Em Produção': 'bg-amber-100 text-amber-700 border-amber-200',
  'Concluído': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Atrasado': 'bg-red-100 text-red-700 border-red-200'
};

export const MOCK_USERS: User[] = [
  { id: 'admin-id', nome: 'ADMINISTRADOR', email: 'adm', role: 'Admin', cargo: 'DIRETORIA', departamento: 'Geral', password: DEFAULT_ADMIN_PASS },
  { id: 'u2', nome: 'CARLOS ARTE', email: 'arte', role: 'Operador', cargo: 'DESIGNER', departamento: 'preImpressao', password: DEFAULT_USER_PASS },
  { id: 'u3', nome: 'JOÃO PRINT', email: 'print', role: 'Operador', cargo: 'IMPRESSOR', departamento: 'impressao', password: DEFAULT_USER_PASS },
  { id: 'u4', nome: 'MARCOS SERRALHEIRO', email: 'producao', role: 'Operador', cargo: 'METALÚRGICO', departamento: 'producao', password: DEFAULT_USER_PASS }
];

export const VENDORS = ['ALINE', 'LARA', 'CADU', 'AUGUSTO', 'HÉLIO', 'RODOLFO'];

// Helper para gerar datas relativas
const getDate = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const today = getDate(0);
const yesterday = getDate(-1);
const tomorrow = getDate(1);

export const MOCK_ORDERS: Order[] = [
  // --- ATRASADAS ---
  {
    id: '1', or: '112010', numeroItem: '01', lote: '01', versao: 'V1', cliente: 'REDE GRAAL', vendedor: 'ALINE', item: 'LUMINOSO BACKLIGHT 3X1M - RESTAURANTE',
    dataEntrega: getDate(-5), createdAt: getDate(-10), preImpressao: 'Concluído', impressao: 'Concluído', producao: 'Em Produção', instalacao: 'Pendente', expedicao: 'Pendente',
    observacao: 'ATRASADO - PRIORIDADE MÁXIMA', prioridade: 'Alta', history: [], isArchived: false
  },
  {
    id: '2', or: '112011', numeroItem: 'A-02', lote: '01', versao: 'V2', cliente: 'POSTO SHELL', vendedor: 'AUGUSTO', item: 'ADESIVOS DE BOMBA (KIT COMPLETO)',
    dataEntrega: getDate(-2), createdAt: getDate(-8), preImpressao: 'Concluído', impressao: 'Em Produção', producao: 'Pendente', instalacao: 'Pendente', expedicao: 'Pendente',
    observacao: '', prioridade: 'Média', history: [], isArchived: false
  },

  // --- HOJE ---
  {
    id: '3', or: '112014', numeroItem: '001', lote: '01', versao: 'V1', cliente: 'SHOPPING LINS - FACHADA', vendedor: 'ALINE', item: 'PAINEL ACM 12X3M + LETRA CAIXA',
    dataEntrega: today, createdAt: getDate(-3), preImpressao: 'Concluído', impressao: 'Concluído', producao: 'Em Produção', instalacao: 'Pendente', expedicao: 'Pendente',
    observacao: 'USAR LED 6500K', prioridade: 'Alta', history: [
      { userId: 'u2', userName: 'CARLOS ARTE', timestamp: yesterday, status: 'Concluído', sector: 'preImpressao' }
    ], isArchived: false
  },
  {
    id: '4', or: '112016', numeroItem: '33', lote: '01', versao: 'V1', cliente: 'RESTAURANTE SABOR', vendedor: 'HÉLIO', item: 'CARDÁPIO EM PS 2MM COM IMPRESSÃO UV',
    dataEntrega: today, createdAt: yesterday, preImpressao: 'Em Produção', impressao: 'Pendente', producao: 'Pendente', instalacao: 'Pendente', expedicao: 'Pendente',
    observacao: 'URGENTE PARA INAUGURAÇÃO', prioridade: 'Alta', history: [], isArchived: false
  },

  // --- AMANHÃ E SEMANA ATUAL ---
  {
    id: '5', or: '112015', numeroItem: 'A-10', lote: '02', versao: 'V1', cliente: 'FARMÁCIA VIDA', vendedor: 'LARA', item: 'FAIXA DE GÔNDOLA PVC 0.5MM',
    dataEntrega: tomorrow, createdAt: yesterday, preImpressao: 'Pendente', impressao: 'Pendente', producao: 'Pendente', instalacao: 'Pendente', expedicao: 'Pendente',
    observacao: '1000 UNIDADES', prioridade: 'Média', history: [], isArchived: false
  },
  {
    id: '6', or: '112018', numeroItem: '01', lote: '01', versao: 'V3', cliente: 'MERCADO MUNICIPAL', vendedor: 'CADU', item: 'BANNER LONA 440G 5X2M ILHÓS',
    dataEntrega: getDate(3), createdAt: today, preImpressao: 'Pendente', impressao: 'Pendente', producao: 'Pendente', instalacao: 'Pendente', expedicao: 'Pendente',
    observacao: '', prioridade: 'Baixa', history: [], isArchived: false
  },
  {
    id: '7', or: '112020', numeroItem: '05', lote: '01', versao: 'V1', cliente: 'ACADEMIA SMART', vendedor: 'RODOLFO', item: 'ADESIVO JATEADO VIDRO 3X2M',
    dataEntrega: getDate(4), createdAt: today, preImpressao: 'Em Produção', impressao: 'Pendente', producao: 'Pendente', instalacao: 'Pendente', expedicao: 'Pendente',
    observacao: 'RECORTAR LOGO', prioridade: 'Média', history: [], isArchived: false
  },

  // --- PRÓXIMA SEMANA / FUTURO ---
  {
    id: '8', or: '112025', numeroItem: 'TOTEM', lote: '01', versao: 'V1', cliente: 'CONSTRUTORA TENDA', vendedor: 'ALINE', item: 'TOTEM SINALIZAÇÃO INTERNA MDF E ACRÍLICO',
    dataEntrega: getDate(10), createdAt: yesterday, preImpressao: 'Pendente', impressao: 'Pendente', producao: 'Pendente', instalacao: 'Pendente', expedicao: 'Pendente',
    observacao: 'AGUARDANDO APROVAÇÃO DE COR', prioridade: 'Média', history: [], isArchived: false
  },
  {
    id: '9', or: '112030', numeroItem: '01', lote: '01', versao: 'V1', cliente: 'PREFEITURA MUNICIPAL', vendedor: 'AUGUSTO', item: 'KIT SINALIZAÇÃO VIÁRIA (REFLETIVO)',
    dataEntrega: getDate(15), createdAt: getDate(-1), preImpressao: 'Concluído', impressao: 'Pendente', producao: 'Pendente', instalacao: 'Pendente', expedicao: 'Pendente',
    observacao: 'MATERIAL REFLETIVO CHEGA DIA 20', prioridade: 'Alta', history: [], isArchived: false
  },

  // --- FINALIZADAS / ARQUIVADAS ---
  {
    id: '10', or: '111050', numeroItem: '554', lote: '01', versao: 'V2', cliente: 'BANCO ITAU', vendedor: 'LARA', item: 'PLACA INTERNA ACRÍLICO CRISTAL 10MM',
    dataEntrega: getDate(-15), createdAt: getDate(-20), preImpressao: 'Concluído', impressao: 'Concluído', producao: 'Concluído', instalacao: 'Concluído', expedicao: 'Concluído',
    observacao: '', prioridade: 'Baixa', history: [], isArchived: true, archivedAt: getDate(-14)
  },
  {
    id: '11', or: '111055', numeroItem: '01', lote: '01', versao: 'V1', cliente: 'PADARIA CENTRAL', vendedor: 'CADU', item: 'ADESIVO FREEZER',
    dataEntrega: getDate(-10), createdAt: getDate(-12), preImpressao: 'Concluído', impressao: 'Concluído', producao: 'Concluído', instalacao: 'Concluído', expedicao: 'Concluído',
    observacao: '', prioridade: 'Média', history: [], isArchived: true, archivedAt: getDate(-10)
  }
];
