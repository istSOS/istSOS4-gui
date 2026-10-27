import QcEditorPage from '@/features/qc/components/QcEditorPage'

import { notFound, redirect } from 'next/navigation'

import { getQcAccess } from '@/server/qc'

export default async function Page() {
  const access = await getQcAccess()
  if (access === 401) redirect('/login')
  if (access === 403 || access === 404) notFound()

  return <QcEditorPage accessUnavailable={access === 503} />
}
