import React from 'react';
import Spinner from './Spinner';

const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No data records found.',
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  actions,
}) => {
  return (
    <div className="flex flex-col w-full">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12">
                  <div className="flex justify-center items-center">
                    <Spinner size="lg" />
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-16 text-center">
                  <div className="text-sm font-medium text-slate-400 dark:text-slate-500">
                    {emptyMessage}
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={row._id || rowIdx}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors text-slate-700 dark:text-slate-200"
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`px-6 py-4.5 text-sm ${col.className || ''}`}
                    >
                      {col.cell ? col.cell(row) : row[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile/Tablet Card Layout */}
      <div className="flex flex-col gap-4 md:hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <Spinner size="lg" />
          </div>
        ) : data.length === 0 ? (
          <div className="px-6 py-16 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="text-sm font-medium text-slate-400 dark:text-slate-500">
              {emptyMessage}
            </div>
          </div>
        ) : (
          data.map((row, rowIdx) => (
            <div
              key={row._id || rowIdx}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-sm"
            >
              {columns.map((col, colIdx) => (
                <div
                  key={colIdx}
                  className="flex justify-between items-start gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-2.5 last:border-b-0 last:pb-0"
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">
                    {col.header}
                  </span>
                  <div className="text-xs text-slate-700 dark:text-slate-200 text-right font-medium">
                    {col.cell ? col.cell(row) : row[col.accessor]}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Pagination Footer */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4 mt-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
