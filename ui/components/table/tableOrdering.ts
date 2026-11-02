import type { SortDescriptor } from '@react-types/shared'
import type { Key } from 'react'

export function orderTableItems<TItem, TColumnKey extends string>(
  items: TItem[],
  sort: SortDescriptor,
  getSortValue:
    | ((item: TItem, column: TColumnKey) => string | number | null)
    | undefined,
  rowKey: (item: TItem, index: number) => Key,
  pinnedKeys?: ReadonlySet<Key>
): TItem[] {
  if (!getSortValue && !pinnedKeys?.size) return items
  const direction = sort.direction === 'descending' ? -1 : 1
  return [...items].sort((a, b) => {
    const priority =
      Number(pinnedKeys?.has(rowKey(b, 0)) ?? false) -
      Number(pinnedKeys?.has(rowKey(a, 0)) ?? false)
    if (priority) return priority
    if (!getSortValue || !sort.column) return 0
    const first = getSortValue(a, String(sort.column) as TColumnKey)
    const second = getSortValue(b, String(sort.column) as TColumnKey)
    return (
      (typeof first === 'number' && typeof second === 'number'
        ? first - second
        : String(first ?? '').localeCompare(String(second ?? ''), undefined, {
            numeric: true,
            sensitivity: 'base',
          })) * direction
    )
  })
}
