/** Shared appearance for data tables, including native tables with editable cells. */
export const tableStyles = {
  header: 'bg-default-100 text-default-500',
  headerCell:
    'h-7 px-2 py-0.5 text-[10px] font-semibold leading-4 whitespace-nowrap',
  cell: 'h-7 border-b border-default-200 px-2 py-0.5 text-xs leading-4 whitespace-nowrap',
  row: 'table-row-hover',
  selectedRow: '[&>td]:!bg-primary-100 [&>td]:font-medium',
  stripedRow: 'even:bg-default-100',
  numeric: 'text-right tabular-nums',
  empty: 'p-6 text-center text-sm text-default-500',
  columnOptions: 'sticky right-0 z-20 w-9 min-w-9 bg-default-100',
  action:
    'inline-flex h-6 w-6 min-w-6 items-center justify-center rounded text-primary hover:bg-default-100 disabled:opacity-50',
}
