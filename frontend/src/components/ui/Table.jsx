import cn from '../../utils/cn.js';
import { PageSpinner } from './Spinner.jsx';
import EmptyState from './EmptyState.jsx';

const Table = ({
  columns       = [],
  data          = [],
  loading       = false,
  emptyMessage  = 'No data found',
  emptyIcon,
  keyExtractor  = (row, i) => row.id ?? row._id ?? i,
  onRowClick,
  className,
}) => {
  if (loading) return <PageSpinner />;

  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-slate-200', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-start text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap',
                  col.headerClassName
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-16 text-center">
                <EmptyState message={emptyMessage} icon={emptyIcon} />
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={keyExtractor(row, i)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'transition-colors duration-100',
                  onRowClick && 'cursor-pointer hover:bg-brand-50/40'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn('px-4 py-3 text-slate-700 text-start', col.className)}
                  >
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
