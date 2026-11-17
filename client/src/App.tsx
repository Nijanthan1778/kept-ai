import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type ApiStatus = 'checking' | 'ok' | 'down'

// Phase 1 placeholder: proves the Vite → API proxy works. Replaced by the real UI in phase 6.
function App() {
  const [status, setStatus] = useState<ApiStatus>('checking')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => setStatus(res.ok ? 'ok' : 'down'))
      .catch(() => setStatus('down'))
  }, [])

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Kept AI</CardTitle>
          <CardDescription>Your AI knowledge inbox</CardDescription>
        </CardHeader>
        <CardContent>API status: {status}</CardContent>
      </Card>
    </main>
  )
}

export default App
