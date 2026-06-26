import React from 'react';
import {
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Truck,
  Calendar,
  Layers,
} from 'lucide-react';
import { StatsCard } from '../../components/ui/Card';

const StatsCards = ({ stats }) => {
  const cards = [
    {
      title: 'Total Sent',
      value: stats?.totalSent || 0,
      icon: ArrowUpRight,
      iconColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40',
    },
    {
      title: 'Pending Approval',
      value: stats?.pendingApproval || 0,
      icon: Clock,
      iconColor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
    },
    {
      title: 'Completed Movement',
      value: stats?.completedMovement || 0,
      icon: CheckCircle2,
      iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      title: 'Rejected Movements',
      value: stats?.rejectedMovement || 0,
      icon: XCircle,
      iconColor: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40',
    },
    {
      title: 'Internal Receipts',
      value: stats?.internalReceipts || 0,
      icon: Layers,
      iconColor: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40',
    },
    {
      title: 'External Receipts',
      value: stats?.externalReceipts || 0,
      icon: Truck,
      iconColor: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40',
    },
    {
      title: 'Activity Today',
      value: stats?.activityToday || 0,
      icon: Calendar,
      iconColor: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40',
    },
    {
      title: 'Activity This Month',
      value: stats?.activityThisMonth || 0,
      icon: FileSpreadsheet,
      iconColor: 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4.5 md:gap-6">
      {cards.map((card, idx) => (
        <StatsCard
          key={idx}
          title={card.title}
          value={card.value}
          icon={card.icon}
          iconColor={card.iconColor}
        />
      ))}
    </div>
  );
};

export default StatsCards;
