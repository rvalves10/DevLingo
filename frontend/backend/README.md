# DevLingo — Backend API

Servidor Node.js + Express que conecta o frontend do DevLingo à API do Google Gemini (Tutor IA).

## Rodando localmente

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com sua chave do Gemini (gratuita em aistudio.google.com/app/apikey)

# 3. Iniciar o servidor
npm start
# → http://localhost:3001
```

## Variáveis de ambiente

| Variável | Descrição | Default |
|----------|-----------|---------|
| `GEMINI_API_KEY` | Chave da API do Google Gemini | — |
| `GEMINI_MODEL` | Modelo do Gemini a usar | `gemini-2.5-flash` |
| `FRONTEND_URL` | URL do frontend (CORS) | `http://localhost:5173` |
| `PORT` | Porta do servidor | `3001` |

> ⚠️ Use `gemini-2.5-flash` ou superior. Os modelos `gemini-2.0-*` e `gemini-1.5-*` não têm cota gratuita na chave gratuita.

## Endpoints

### `GET /`
Health check — retorna `{ status: "DevLingo API online 🚀 (Gemini)" }`

### `POST /api/chat`
Envia mensagens para o Tutor IA socrático.

**Body:**
```json
{
  "messages": [
    { "role": "user", "content": "O que é um loop?" }
  ]
}
```

**Resposta:**
```json
{
  "reply": "Boa pergunta! Antes de te explicar diretamente..."
}
```

## Deploy no Render (gratuito)

1. Suba o código no GitHub
2. Acesse [render.com](https://render.com) e crie conta com GitHub
3. **New → Web Service** → conecte o repositório
4. Configure:
   - **Root Directory:** `frontend/backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Em **Environment Variables**, adicione `GEMINI_API_KEY`, `GEMINI_MODEL` e `FRONTEND_URL`
6. Clique em **Deploy**

> O tier gratuito do Render "dorme" após 15 min de inatividade. A primeira requisição pode demorar ~30s para acordar o servidor.
