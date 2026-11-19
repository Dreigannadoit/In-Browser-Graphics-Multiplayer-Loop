import { createRoot } from 'react-dom/client'
import './dev/devGate' // console-only developer-mode gate (devMode = True)
import App from './App'
import "./index.css"

createRoot(document.getElementById('root')).render(<App />)
