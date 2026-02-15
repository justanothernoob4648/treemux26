'use client'

import { useRouter } from 'next/navigation'
import LandingPage from '../components/LandingPage'

export default function Home() {
  const router = useRouter()

  const handleStart = () => {
    router.push('/live')
  }

  return <LandingPage onStart={handleStart} />
}
