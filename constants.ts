
import { Order, User, Status } from './types';

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
  { id: 'u4', nome: 'MARCOS SERRALHEIRO', email: 'producao', role: 'Operador', cargo: 'METALÚRGICO', departamento: 'producao', password: DEFAULT_USER_PASS },
  { id: 'u5', nome: 'EQUIPE INSTALA', email: 'instala', role: 'Operador', cargo: 'INSTALADOR', departamento: 'instalacao', password: DEFAULT_USER_PASS }
];

export const VENDORS = ['ALINE', 'LARA', 'CADU', 'AUGUSTO', 'HÉLIO', 'RODOLFO', 'MARIANA'];
const CLIENTS = ['REDE GRAAL', 'BANCO ITAU', 'POSTO SHELL', 'FARMÁCIA VIDA', 'MERCADO MUNICIPAL', 'SHOPPING LINS', 'RESTAURANTE SABOR', 'CONSTRUTORA TENDA', 'ACADEMIA SMART', 'PREFEITURA MUNICIPAL', 'PADARIA CENTRAL', 'CLÍNICA SAÚDE'];
const ITEMS = [
    'LUMINOSO BACKLIGHT 3X1M', 'ADESIVOS DE BOMBA (KIT)', 'PAINEL ACM 12X3M + LETRA', 'CARDÁPIO EM PS 2MM UV', 
    'FAIXA DE GÔNDOLA PVC', 'BANNER LONA 440G', 'ADESIVO JATEADO VIDRO', 'TOTEM SINALIZAÇÃO MDF', 
    'PLACA DE OBRA 2X1M', 'ENVELOPAMENTO DE FROTA', 'LETRA CAIXA INOX', 'SINALIZAÇÃO DE EMERGÊNCIA'
];

// Helper para gerar datas
const getDate = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const generateMockOrders = (): Order[] => {
    const orders: Order[] = [];
    let orCounter = 112000;

    // Gerar 60 ordens distribuídas em -30 dias a +30 dias
    for (let i = -30; i <= 30; i++) {
        // Pula alguns dias para dar realismo (nem todo dia tem entrega)
        if (Math.random() > 0.7) continue;

        const countPerDay = Math.floor(Math.random() * 3) + 1; // 1 a 3 ordens por dia

        for (let j = 0; j < countPerDay; j++) {
            orCounter++;
            const isPast = i < 0;
            const isToday = i === 0;
            
            // Lógica de Status Baseada na Data
            let statusPre: Status = 'Pendente';
            let statusImp: Status = 'Pendente';
            let statusProd: Status = 'Pendente';
            let statusInst: Status = 'Pendente';
            let statusExp: Status = 'Pendente';
            let isArchived = false;
            let archivedAt = undefined;

            if (isPast) {
                // Passado: Maioria concluída ou atrasada
                if (Math.random() > 0.2) {
                    statusPre = 'Concluído'; statusImp = 'Concluído'; statusProd = 'Concluído'; statusInst = 'Concluído'; statusExp = 'Concluído';
                    isArchived = true;
                    archivedAt = getDate(i + 1); // Arquivado dia seguinte a entrega
                } else {
                    // Atrasado
                    statusPre = 'Concluído'; statusImp = 'Em Produção'; 
                }
            } else if (isToday) {
                // Hoje: Em andamento
                statusPre = 'Concluído'; statusImp = 'Concluído'; statusProd = 'Em Produção';
            } else {
                // Futuro
                if (i < 5) {
                    statusPre = 'Em Produção'; // Próximos dias
                }
            }

            orders.push({
                id: orCounter.toString(),
                or: orCounter.toString(),
                numeroItem: Math.random() > 0.5 ? String(Math.floor(Math.random() * 100)) : undefined,
                quantidade: String(Math.floor(Math.random() * 10) + 1),
                cliente: CLIENTS[Math.floor(Math.random() * CLIENTS.length)],
                vendedor: VENDORS[Math.floor(Math.random() * VENDORS.length)],
                item: ITEMS[Math.floor(Math.random() * ITEMS.length)],
                dataEntrega: getDate(i),
                createdAt: getDate(i - 10), // Criado 10 dias antes da entrega
                preImpressao: statusPre,
                impressao: statusImp,
                producao: statusProd,
                instalacao: statusInst,
                expedicao: statusExp,
                prioridade: Math.random() > 0.8 ? 'Alta' : Math.random() > 0.5 ? 'Média' : 'Baixa',
                isArchived: isArchived,
                archivedAt: archivedAt,
                isRemake: Math.random() > 0.95, // 5% de chance de ser refazimento
                observacao: Math.random() > 0.7 ? 'ATENÇÃO AOS DETALHES DE ACABAMENTO' : ''
            });
        }
    }
    return orders;
};

export const MOCK_ORDERS: Order[] = generateMockOrders();
