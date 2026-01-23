
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

const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

export const MOCK_ORDERS: Order[] = [
  {
    id: '1', or: '112014', numeroItem: '001', lote: '01', versao: 'V1', cliente: 'SHOPPING LINS - FACHADA', vendedor: 'ALINE', item: 'PAINEL ACM 12X3M + LETRA CAIXA ILUMINADA',
    dataEntrega: today, createdAt: yesterday, preImpressao: 'Concluído', impressao: 'Concluído', producao: 'Em Produção', instalacao: 'Pendente', expedicao: 'Pendente',
    observacao: 'USAR LED 6500K', prioridade: 'Alta', history: [
      { userId: 'u2', userName: 'CARLOS ARTE', timestamp: yesterday, status: 'Concluído', sector: 'preImpressao' },
      { userId: 'u3', userName: 'JOÃO PRINT', timestamp: today, status: 'Concluído', sector: 'impressao' }
    ], isArchived: false
  },
  {
    id: '2', or: '112015', numeroItem: 'A-10', lote: '02', versao: 'V1', cliente: 'POSTO IPIRANGA', vendedor: 'AUGUSTO', item: 'ADESIVAÇÃO TOTAL DE BOMBAS E TOTEM',
    dataEntrega: tomorrow, createdAt: yesterday, preImpressao: 'Pendente', impressao: 'Pendente', producao: 'Pendente', instalacao: 'Pendente', expedicao: 'Pendente',
    observacao: '', prioridade: 'Média', history: [], isArchived: false
  },
  {
    id: '3', or: '112010', numeroItem: '554', lote: '01', versao: 'V2', cliente: 'BANCO ITAU', vendedor: 'LARA', item: 'PLACA INTERNA ACRÍLICO CRISTAL 10MM',
    dataEntrega: yesterday, createdAt: yesterday, preImpressao: 'Concluído', impressao: 'Concluído', producao: 'Concluído', instalacao: 'Concluído', expedicao: 'Concluído',
    observacao: '', prioridade: 'Baixa', history: [], isArchived: true, archivedAt: yesterday
  },
  {
    id: '4', or: '112016', numeroItem: '33', lote: '01', versao: 'V1', cliente: 'RESTAURANTE SABOR', vendedor: 'HÉLIO', item: 'CARDÁPIO EM PS 2MM COM IMPRESSÃO UV',
    dataEntrega: today, createdAt: yesterday, preImpressao: 'Em Produção', impressao: 'Pendente', producao: 'Pendente', instalacao: 'Pendente', expedicao: 'Pendente',
    observacao: 'URGENTE PARA INAUGURAÇÃO', prioridade: 'Alta', history: [], isArchived: false
  }
];
