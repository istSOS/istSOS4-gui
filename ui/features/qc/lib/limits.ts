/** Interactive limits enforced by qcData.ts and the read-only QC service. */
export const QC_LIMITS = {
  observations: 20000,
  contextBuffer: 20000,
  previewRows: 60000,
  // qc-service/historical.py: ROWS_PER_CALL. This is a processing batch size,
  // not a memory limit or a guarantee about execution time.
  batchValues: 2000000,
} as const
