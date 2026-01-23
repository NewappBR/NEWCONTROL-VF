
import React from 'react';
import { Notification, ProductionStep, DEPARTMENTS } from '../types';

interface NotificationPanelProps {
  notifications: Notification[];
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onAction?: (notification: Notification) => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ 
  notifications, 
  onClose, 
  onMarkAsRead,
  onMarkAllAsRead,
  onAction
}) => {
  const groupedNotifications = notifications.reduce((acc, notif) => {
    const sector = notif.targetSector || 'Geral';
    if (!acc[sector]) acc[sector] = [];
    acc[sector].push(notif);
    return acc;
  }, {} as Record<string, Notification[]>);

  const sectors = Object.keys(groupedNotifications).sort();

  return (
    <div className="fixed inset-0 z-[999] md:absolute md:top-14 md:right-0 md:w-96 md:h-auto md:max-h-[85vh] md:inset-auto bg-white dark:bg-slate-900 md:rounded-3xl shadow-2xl border-none md:border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-top-2 duration-200 flex flex-col">
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 md:gap-0">
            <button onClick={onClose} className="md:hidden p-1 -ml-2 text-slate-400">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2.5"/></svg>
            </button>
            <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Painel de Alertas</h4>
        </div>
        <button 
          onClick={onMarkAllAsRead}
          className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
        >
          Limpar tudo
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {notifications.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center justify-center h-full">
            <svg className="w-12 h-12 text-slate-200 dark:text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Sem alertas novos</p>
          </div>
        ) : (
          <div className="space-y-4 p-2">
            {sectors.map(sector => {
              const sectorLabel = DEPARTMENTS[sector as ProductionStep] || sector;
              const sectorNotifs = groupedNotifications[sector];
              
              return (
                <div key={sector} className="flex flex-col bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center sticky top-0 z-10">
                    <span className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[2px]">{sectorLabel}</span>
                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[8px] font-bold px-1.5 py-0.5 rounded-md">{sectorNotifs.length}</span>
                  </div>
                  
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sectorNotifs.map((notif) => {
                      const indicatorColor = 
                        notif.type === 'urgent' ? 'bg-red-500' : 
                        notif.type === 'warning' ? 'bg-amber-500' : 
                        notif.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500';

                      const textColor = 
                        notif.type === 'urgent' ? 'text-red-600 dark:text-red-400' : 
                        notif.type === 'warning' ? 'text-amber-600 dark:text-amber-400' : 
                        notif.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400';

                      return (
                        <div 
                          key={notif.id} 
                          className="p-3 hover:bg-white dark:hover:bg-slate-800/80 transition-colors cursor-pointer group relative flex gap-3"
                          onClick={() => onMarkAsRead(notif.id)}
                        >
                          {/* Left colored bar indicator */}
                          <div className={`w-1 rounded-full ${indicatorColor} shrink-0`}></div>
                          
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-[8px] font-black uppercase tracking-tighter ${textColor}`}>
                                {notif.title}
                              </span>
                              <span className="text-[7px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">{notif.timestamp}</span>
                            </div>

                            {notif.referenceDate && (
                              <div className="flex items-center gap-1.5 mt-0.5 mb-1.5">
                                 <span className="bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[8px] font-bold px-2 py-0.5 rounded border border-slate-100 dark:border-slate-600 uppercase flex items-center gap-1 w-fit">
                                    📅 {notif.referenceDate.split('-').reverse().join('/')}
                                 </span>
                              </div>
                            )}

                            <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-tight">{notif.message}</p>
                            
                            {notif.actionLabel && onAction && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAction(notif);
                                }}
                                className="mt-2 w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" strokeWidth="2.5"/></svg>
                                {notif.actionLabel}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 text-center shrink-0">
        <button onClick={onClose} className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:text-slate-900 dark:hover:text-white transition-colors">Fechar Painel</button>
      </div>
    </div>
  );
};

export default NotificationPanel;
