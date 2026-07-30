import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import { AuthProvider } from './services/auth.tsx'

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
)
