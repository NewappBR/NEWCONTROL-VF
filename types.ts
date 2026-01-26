
export type Status = 'Pendente' | 'Em Produção' | 'Concluído' | 'Atrasado' | 'Excluído';
export type UserRole = 'Admin' | 'Operador';
export type ProductionStep = 'preImpressao' | 'impressao' | 'producao' | 'instalacao' | 'expedicao' | 'Geral';
export type PeriodFilter = 'Semana' | 'Mês' | 'Ano' | 'Tudo';

export const DEPARTMENTS = {
  preImpressao: 'Design & Pré-Imp',
  impressao: 'Impressão Digital',
  producao: 'Acabamento & Serralheria',
  instalacao: 'Equipe de Campo',
  expedicao: 'Logística & Expedição'
};

export interface User {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  password?: string;
  cargo?: string;
  departamento: keyof typeof DEPARTMENTS | 'Geral';
}

export interface Ramal {
  id: string;
  nome: string; // Nome do setor ou pessoa
  numero: string; // Número do telefone/ramal
  departamento?: string;
}

export interface CompanySettings {
  name: string;
  address: string;
  contact: string;
  logoUrl?: string; // Nova propriedade para logo customizada
  reminderEnabled?: boolean; // Ativar/Desativar notificações
  reminderInstallationDays?: number; // Antecedência para alerta de instalação
  reminderShippingDays?: number; // Antecedência para alerta de expedição
}

export interface HistoryEntry {
  userId: string;
  userName: string;
  timestamp: string;
  status: Status;
  sector: ProductionStep;
}

// Log global para itens que foram excluídos (não atrelados a orders ativas)
export interface GlobalLogEntry {
  id: string;
  userId: string;
  userName: string;
  timestamp: string;
  actionType: 'DELETE_ORDER' | 'DELETE_USER';
  targetInfo: string; // Ex: "O.R 112014 - Cliente X" ou "Usuário João"
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string; // Base64 para armazenamento local
  uploadedAt: string;
}

export interface Order {
  id: string;
  or: string;
  numeroItem?: string; // Campo novo: Identificador manual do item
  quantidade?: string; // Nova propriedade para quantidade de itens
  lote?: string;
  versao?: string;
  cliente: string;
  vendedor: string;
  item: string;
  dataEntrega: string;
  createdAt?: string;
  createdBy?: string; // Nome de quem criou a ordem
  preImpressao: Status;
  impressao: Status;
  producao: Status;
  instalacao: Status;
  expedicao: Status;
  observacao?: string;
  prioridade?: 'Alta' | 'Média' | 'Baixa';
  history?: HistoryEntry[];
  attachments?: Attachment[]; // Lista de anexos
  isArchived: boolean;
  archivedAt?: string;
  isRemake?: boolean; // Flag para indicar se é um item de refazimento/erro
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'urgent' | 'warning' | 'info' | 'success';
  timestamp: string;
  readBy: string[]; // Lista de IDs de usuários que já leram/limparam esta notificação
  actionLabel?: string; // Label for the button (e.g. "RESETAR")
  metadata?: any; // To store data like email to be reset
  targetUserId?: string; // ID do destinatário ou 'ALL'
  targetSector?: string; // Para organizar por setor
  senderName?: string; // Nome de quem enviou
  referenceDate?: string; // Data de referência para o aviso (opcional)
}
