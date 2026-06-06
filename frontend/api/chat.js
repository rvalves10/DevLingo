import { GoogleGenerativeAI } from "@google/generative-ai";

const TUTOR_SYSTEM = `Você é o Tutor DevLingo, assistente pedagógico de lógica de programação para iniciantes.
REGRAS:
1. NUNCA dê a resposta direta. Use o método socrático — perguntas e dicas para o aluno raciocinar.
2. Quando o aluno errar, explique POR QUÊ com linguagem simples e uma analogia do mundo real.
3. Seja encorajador. Celebre o progresso.
4. Foco: lógica de programação para iniciantes (variáveis, condicionais, loops, funções, listas).
5. Respostas curtas — máximo 3 parágrafos.
6. Responda SEMPRE em português do Brasil.`;

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

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
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      systemInstruction: TUTOR_SYSTEM,
    });

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
      msg = "Erro de autenticação — confira a GEMINI_API_KEY nas variáveis de ambiente.";
    } else if (/quota|rate limit|429|RESOURCE_EXHAUSTED/i.test(m)) {
      msg = "Limite gratuito atingido por agora. Aguarde alguns segundos e tente de novo.";
    } else if (/not found|not supported|404/i.test(m)) {
      msg = "Modelo de IA não encontrado. Ajuste GEMINI_MODEL nas variáveis de ambiente.";
    }
    res.status(502).json({ error: msg });
  }
}
