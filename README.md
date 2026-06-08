# DevLingo — Aprenda a programar 🟢

Plataforma gamificada de ensino de lógica de programação para iniciantes, inspirada no Duolingo. Projeto de portfólio.

## Stack

- **React 19 + Vite** — frontend SPA
- **Firebase Auth + Firestore** — autenticação e persistência
- **Pyodide** — execução real de Python no navegador (WebAssembly)
- **Google Gemini** — Tutor IA socrático (via backend)
- **canvas-confetti + Web Audio API** — efeitos de celebração

## Rodando localmente

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas chaves do Firebase e a URL do backend

# 3. Iniciar o frontend
npm run dev
# → http://localhost:5173
```

O backend do Tutor IA fica em `backend/` — veja o README de lá para rodá-lo.

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `VITE_API_URL` | URL do backend (default: `http://localhost:3001`) |
| `VITE_FIREBASE_API_KEY` | Chave pública do Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | Domínio de auth do Firebase |
| `VITE_FIREBASE_PROJECT_ID` | ID do projeto Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | Bucket do Storage |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID do Firebase |
| `VITE_FIREBASE_APP_ID` | App ID do Firebase |

Sem as variáveis do Firebase o app roda em **modo demo** (sem login).

## Deploy

- **Frontend:** Vercel — root directory `frontend/`, build `npm run build`, output `dist/`
- **Backend:** Render — root directory `frontend/backend/`, start `npm start`
