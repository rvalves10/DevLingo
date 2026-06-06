// override: true → o .env tem prioridade sobre variáveis de ambiente do sistema.
require("dotenv").config({ override: true });
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Modelo configurável pelo .env (default: gemini-2.5-flash, gratuito e rápido).
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

const TUTOR_SYSTEM = `Você é o Tutor DevLingo, assistente pedagógico de lógica de programação para iniciantes.
REGRAS:
1. NUNCA dê a resposta direta. Use o método socrático — perguntas e dicas para o aluno raciocinar.
2. Quando o aluno errar, explique POR QUÊ com linguagem simples e uma analogia do mundo real.
3. Seja encorajador. Celebre o progresso.
4. Foco: lógica de programação para iniciantes (variáveis, condicionais, loops, funções, listas).
5. Respostas curtas — máximo 3 parágrafos.
6. Responda SEMPRE em português do Brasil.`;

// Health check
app.get("/", (req, res) => {
  res.json({ status: "DevLingo API online 🚀 (Gemini)" });
});

// Rota do tutor IA
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages é obrigatório e deve ser um array" });
  }
  if (messages.length > 100) {
    return res.status(400).json({ error: "Muitas mensagens no histórico." });
  }
  for (const msg of messages) {
    if (!msg.role || !msg.content || typeof msg.content !== "string") {
      return res.status(400).json({ error: "Formato de mensagem inválido." });
    }
    if (msg.content.length > 4000) {
      return res.status(400).json({ error: "Mensagem muito longa." });
    }
  }

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction: TUTOR_SYSTEM });
    // Converte o formato do chat (role/content) para o do Gemini (role/parts).
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const result = await model.generateContent({ contents });
    res.json({ reply: result.response.text() });
  } catch (err) {
    console.error("Erro na API Gemini:", err.message);
    const m = err.message || "";
    let msg = "O tutor está indisponível no momento. Tente novamente em instantes.";
    if (/API key not valid|API_KEY_INVALID|permission|401|403/i.test(m)) {
      msg = "Erro de autenticação — confira a GEMINI_API_KEY no arquivo .env do backend.";
    } else if (/quota|rate limit|429|RESOURCE_EXHAUSTED/i.test(m)) {
      msg = "Limite gratuito atingido por agora. Aguarde alguns segundos e tente de novo.";
    } else if (/not found|not supported|404/i.test(m)) {
      msg = "Modelo de IA não encontrado. Ajuste GEMINI_MODEL no .env (ex: gemini-1.5-flash).";
    }
    res.status(502).json({ error: msg });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ DevLingo backend (Gemini) rodando na porta ${PORT}`));
