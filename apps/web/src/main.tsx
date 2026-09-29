import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { getTextDirection, type SupportedLocale } from '@game-center/i18n'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()
const locale = ((new URLSearchParams(window.location.search).get('locale') as SupportedLocale | null) ?? 'en')

document.documentElement.lang = locale
document.documentElement.dir = getTextDirection(locale)
document.documentElement.dataset.theme = 'dark'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App locale={locale} />
    </QueryClientProvider>
  </StrictMode>,
)
