/** Version history is opt-in. Disabling it always leaves the GUI on live data. */
export const isVersioningEnabled =
  process.env.NEXT_PUBLIC_VERSIONING_ENABLED?.toLowerCase() === 'true'
