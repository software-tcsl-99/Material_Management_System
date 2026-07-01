import React from 'react';
import {
  Package,
  Clock,
  Reply,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { StatsCard } from '../../components/ui/Card';

const StatsCards = ({ stats, barcodesCount = {}, transactionsCount = {} }) => {
  const cards = [
    {
      title: 'Active Items',
      value: stats?.activeItems ?? 12,
      subtitle: 'in circulation',
      icon: Package,
      iconColor: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    {
      title: 'Pending',
      value: stats?.pending ?? 5,
      subtitle: 'awaiting action',
      icon: Clock,
      iconColor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
      borderColor: 'border-amber-200 dark:border-amber-800',
    },
    {
      title: 'Returned',
      value: stats?.returned ?? 18,
      subtitle: 'returned to store',
      icon: Reply,
      iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
    },
    {
      title: 'Closed',
      value: stats?.closed ?? 7,
      subtitle: 'completed',
      icon: CheckCircle,
      iconColor: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40',
      borderColor: 'border-slate-200 dark:border-slate-800',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4.5 md:gap-6">
      {cards.map((card, idx) => (
        <div 
          key={idx} 
          className={`bg-white dark:bg-slate-900 border ${card.borderColor} p-5 rounded-xl shadow-sm flex items-center justify-between gap-4`}
        >
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
              {card.title}
            </span>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none">
              {card.value}
            </h3>
            <span className="text-[10px] text-slate-500 font-semibold mt-1 block">
              {card.subtitle}
            </span>
          </div>
          <div className={`p-3 rounded-xl shrink-0 ${card.iconColor}`}>
            <card.icon className="w-5 h-5" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
