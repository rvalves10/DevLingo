// ─── Conteúdo das lições (data-driven) ────────────────────────────────────────
// Cada lição: metadados + desafio + uma função check(output, code) que valida
// a SAÍDA real do Python (executado via Pyodide). A trilha segue a ordem deste array.

function lines(out) {
  return out.split("\n").map((s) => s.trim()).filter((l) => l !== "");
}

export const LESSONS = [
  {
    id: "variaveis-l1",
    topic: "variaveis",
    trail: "Variáveis & Tipos",
    tag: "Variáveis & Tipos · Lição 1",
    title: "Guardando dados em variáveis",
    intro: "Uma **variável** é como uma caixa etiquetada: você guarda um valor nela e usa pelo nome depois. Cria-se com `nome = valor`.",
    example: 'cidade = "Recife"\nidade = 25\nprint(cidade)\nprint(idade)',
    challengeTitle: "Crie e imprima uma variável",
    challengeDesc: 'Crie uma variável guardando um **texto** (pode ser seu nome, uma linguagem favorita…) e imprima ela com `print()`.',
    placeholder: '# exemplo: linguagem = "Python"\nnome = ___\nprint(___)',
    xp: 50,
    topicPct: 100,
    successMsg: "**Boa!** Você criou uma variável e imprimiu o valor guardado nela. É assim que todo programa começa a lembrar de coisas. 🎉",
    check(out, code) {
      const o = lines(out);
      const hasAssign = /\w+\s*=\s*['"]/.test(code); // criou uma variável com texto
      const hasPrint = /print\s*\(/.test(code);
      if (hasAssign && hasPrint && o.length > 0) return { ok: true };
      if (!hasAssign) return { ok: false, feedback: "Crie uma variável guardando um texto entre aspas, ex: `nome = \"Ana\"`.", hint: 'nome = "Ana"' };
      return { ok: false, feedback: "Quase! Lembre de **imprimir** a variável com `print()`.", hint: "print(nome)" };
    },
  },
  {
    id: "condicionais-l1",
    topic: "condicionais",
    trail: "Condicionais",
    tag: "Condicionais · Lição 1",
    title: "Tomando decisões com if / else",
    intro: "Com `if` (se) e `else` (senão) o programa **decide** o que fazer. O bloco do `if` só roda quando a condição é verdadeira.",
    example: 'temp = 30\nif temp > 25:\n    print("calor")\nelse:\n    print("frio")',
    challengeTitle: "Aprovado ou reprovado?",
    challengeDesc: "A variável `nota` já vale **7**. Complete o `if` para imprimir `aprovado` quando a nota for maior ou igual a 6.",
    placeholder: 'nota = 7\nif ___:\n    print("aprovado")\nelse:\n    print("reprovado")',
    xp: 50,
    topicPct: 100,
    successMsg: "**Excelente!** Seu programa tomou uma decisão sozinho com base numa condição. É o coração da lógica de programação. 🧠",
    check(out, code) {
      if (!/\bif\b/.test(code)) return { ok: false, feedback: "Você precisa usar um **if** para testar a condição.", hint: "if nota >= 6:" };
      const o = lines(out);
      if (o.includes("aprovado") && !o.includes("reprovado")) return { ok: true };
      return { ok: false, feedback: "Com nota 7 deveria sair **aprovado**. Confira a condição (nota maior ou igual a 6).", hint: 'if nota >= 6:\n    print("aprovado")' };
    },
  },
  {
    id: "loops-l3",
    topic: "loops",
    trail: "Loops & Iteração",
    tag: "Loops & Iteração · Lição 3",
    title: "Como um loop while funciona por dentro",
    intro: "Um loop **while** repete enquanto a condição for verdadeira. Ele precisa de três coisas: uma **condição**, uma **ação** e um jeito de **avançar** — senão vira um loop infinito!",
    example: "i = 1\nwhile i <= 3:\n    print(i)\n    i += 1",
    challengeTitle: "Complete o loop que imprime de 1 até 5",
    challengeDesc: "Use um loop `while` para imprimir cada número de 1 a 5. Lembre-se de incrementar a variável!",
    placeholder: "# Escreva seu código aqui...\ni = 1\nwhile ___:\n    print(___)\n    i = ___",
    xp: 50,
    topicPct: 100,
    successMsg: "**Excelente!** Seu loop está perfeito. Você usou a condição correta e lembrou de incrementar `i`, evitando um loop infinito! 🎉",
    check(out) {
      if (lines(out).join(",") === "1,2,3,4,5") return { ok: true };
      return { ok: false, feedback: "A saída deve ser os números de 1 a 5, um por linha. Verifique a condição do while e o incremento.", hint: "while i <= 5:\n    print(i)\n    i += 1" };
    },
    // simulação visual passo a passo (exclusiva desta lição)
    trace: {
      headers: ["Volta", "i", "i < 4?", "print(i)"],
      steps: [
        { code: "i = 0  →  loop começa", cond: "0 < 4", result: "✓ true", out: 'print(0) → "0"', row: 1, rI: "0", rC: "✓", rP: "0" },
        { code: "i += 1  →  i agora é 1", cond: "1 < 4", result: "✓ true", out: 'print(1) → "1"', row: 2, rI: "1", rC: "✓", rP: "1" },
        { code: "i += 1  →  i agora é 2", cond: "2 < 4", result: "✓ true", out: 'print(2) → "2"', row: 3, rI: "2", rC: "✓", rP: "2" },
        { code: "i += 1  →  i agora é 3", cond: "3 < 4", result: "✓ true", out: 'print(3) → "3"', row: 4, rI: "3", rC: "✓", rP: "3" },
        { code: "i += 1  →  i agora é 4", cond: "4 < 4", result: "✗ false", out: "loop encerrado", row: 5, rI: "4", rC: "✗", rP: "—" },
      ],
      tableRows: [
        { volta: "início", i: "0", c: "—", p: "—" },
        { volta: "1ª", i: "—", c: "—", p: "—" },
        { volta: "2ª", i: "—", c: "—", p: "—" },
        { volta: "3ª", i: "—", c: "—", p: "—" },
        { volta: "4ª", i: "—", c: "—", p: "—" },
        { volta: "5ª", i: "—", c: "✗ para", p: "—" },
      ],
    },
  },
  {
    id: "funcoes-l1",
    topic: "funcoes",
    trail: "Funções",
    tag: "Funções · Lição 1",
    title: "Criando funções reutilizáveis",
    intro: "Uma **função** é um bloco de código reutilizável. Você define com `def nome(parâmetros):` e devolve um resultado com `return`.",
    example: 'def saudacao(nome):\n    return "Olá, " + nome\nprint(saudacao("Ana"))',
    challengeTitle: "Uma função que soma",
    challengeDesc: "Crie uma função `somar(a, b)` que **retorne** a soma dos dois números, e imprima `somar(7, 3)`.",
    placeholder: "def somar(a, b):\n    return ___\nprint(somar(7, 3))",
    xp: 50,
    topicPct: 100,
    successMsg: "**Mandou bem!** Funções deixam seu código organizado e reutilizável — você escreve uma vez e usa quantas vezes quiser. 🚀",
    check(out, code) {
      if (!/\bdef\b/.test(code)) return { ok: false, feedback: "Defina a função com **def somar(a, b):**", hint: "def somar(a, b):\n    return a + b" };
      if (lines(out).includes("10")) return { ok: true };
      return { ok: false, feedback: "`somar(7, 3)` deve resultar em **10**. Sua função está retornando `a + b`?", hint: "return a + b" };
    },
  },
  {
    id: "arrays-l1",
    topic: "arrays",
    trail: "Arrays & Objetos",
    tag: "Arrays & Objetos · Lição 1",
    title: "Listas: vários valores em ordem",
    intro: "Uma **lista** guarda vários valores em ordem. Você acessa cada item pelo **índice**, que começa em `0` (o primeiro item é o `[0]`).",
    example: 'cores = ["azul", "verde", "rosa"]\nprint(cores[0])\nprint(cores[2])',
    challengeTitle: "O primeiro da lista",
    challengeDesc: 'Crie uma **lista** com algumas coisas (frutas, nomes…) e imprima o **primeiro** item — lembre que o índice começa em `0`.',
    placeholder: 'frutas = [___, ___]\nprint(frutas[0])',
    xp: 50,
    topicPct: 100,
    successMsg: "**Perfeito!** Listas são essenciais — quase todo app guarda coleções de dados assim (mensagens, produtos, usuários…). 🎯",
    check(out, code) {
      const o = lines(out);
      const hasList = /=\s*\[.*\]/.test(code);
      const hasIndex0 = /\[\s*0\s*\]/.test(code);
      if (hasList && hasIndex0 && o.length > 0) return { ok: true };
      if (!hasList) return { ok: false, feedback: "Crie uma **lista** com colchetes, ex: `frutas = [\"maçã\", \"banana\"]`.", hint: 'frutas = ["maçã", "banana"]' };
      return { ok: false, feedback: "Imprima o **primeiro** item — o índice começa em `0`: `print(frutas[0])`.", hint: "print(frutas[0])" };
    },
  },
];

export const LESSON_ORDER = LESSONS.map((l) => l.id);

export function getLesson(id) {
  return LESSONS.find((l) => l.id === id) || LESSONS[0];
}

// Primeira lição ainda não concluída (para o botão "começar").
export function firstIncompleteLesson(completed = []) {
  return LESSONS.find((l) => !completed.includes(l.id)) || LESSONS[LESSONS.length - 1];
}

// Status da trilha por lição: completa → done; primeira incompleta → active; resto → locked.
export function trailStatus(completed = []) {
  const firstOpen = firstIncompleteLesson(completed).id;
  const map = {};
  for (const l of LESSONS) {
    map[l.trail] = completed.includes(l.id) ? "done" : l.id === firstOpen ? "active" : "locked";
  }
  return map;
}
