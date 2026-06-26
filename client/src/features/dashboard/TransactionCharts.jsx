import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import Card from '../../components/ui/Card';
import RecentActivities from './RecentActivities';

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

const TransactionCharts = ({ dailyData = [], docTypeData = [], activities = [], isAdmin = false }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Daily Movements Area Chart */}
      <Card title="Movement Volume Trend" subtitle="Daily transaction count for the last 14 days" className="lg:col-span-2">
        <div className="h-80 w-full mt-2">
          {dailyData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">No trend data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.08)" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="transparent" />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="transparent" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#ffffff'
                  }} 
                />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Document Type Distribution Pie Chart */}
      <Card title="Document Types" subtitle="Distribution of movement documents">
        <div className="h-80 w-full flex flex-col items-center justify-center">
          {docTypeData.length === 0 ? (
            <div className="text-xs text-slate-400">No document distribution data</div>
          ) : (
            <>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={docTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {docTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: '#ffffff'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                {docTypeData.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                      {entry.name}: {entry.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Activity Feed - only for admin */}
      {isAdmin && (
        <div className="lg:col-span-3">
          <RecentActivities activities={activities} />
        </div>
      )}
    </div>
  );
};

export default TransactionCharts;
