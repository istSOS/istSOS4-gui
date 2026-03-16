'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import Home from '@/app/Home'

import { getThings } from '@/services/things'

export default async function Page() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    redirect('/login')
  }

  try {
    const things = await getThings(token)
    return <Home things={things.thingData} />
  } catch (error) {
    redirect('/login')
  }
}
