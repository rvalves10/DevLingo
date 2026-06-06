// ─── Camada de dados do usuário (Firestore) ──────────────────────────────────
// Cada usuário tem um documento em /users/{uid} com seu progresso real.
import { doc, getDoc, setDoc, updateDoc, increment, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export const LEVEL_TITLES = ["Iniciante", "Novato", "Aprendiz", "Júnior", "Codador", "Debugger", "Pleno", "Sênior", "Arquiteto", "Mestre", "Lenda"];
export const XP_PER_LEVEL = 200;

// Deriva nível, título e progresso a partir do XP total.
export function levelInfo(xp = 0) {
  const safe = Math.max(0, xp || 0);
  const level = Math.floor(safe / XP_PER_LEVEL) + 1;
  const xpInto = safe % XP_PER_LEVEL;
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  return { level, title, xpInto, xpForNext: XP_PER_LEVEL, pct: Math.round((xpInto / XP_PER_LEVEL) * 100) };
}

// Rede de segurança: se o Firestore não responder (ex: banco ainda não criado),
// rejeita em vez de ficar pendurado para sempre.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout em ${label} (${ms}ms) — o Firestore foi criado no console?`)), ms)),
  ]);
}

function todayStr() {
  // data LOCAL (não UTC) para o streak respeitar o "hoje" do fuso do usuário
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}

function defaults() {
  return {
    xp: 0,
    streak: 1,
    lives: 5,
    badges: [],
    completedLessons: [],
    topicProgress: { variaveis: 0, condicionais: 0, loops: 0, funcoes: 0, arrays: 0 },
  };
}

// Dados mínimos para nunca deixar o usuário "preso" caso o Firestore falhe.
export function emptyUserData(user) {
  return { name: user?.displayName || user?.email?.split("@")[0] || "Dev", email: user?.email || "", ...defaults() };
}

// Regras de badges automáticas — quais o usuário merece dado o progresso atual.
export function earnedBadges(data) {
  const ids = [];
  const completed = data.completedLessons || [];
  const streak = data.streak || 0;
  if (completed.length >= 1) ids.push("first-code");
  if (completed.includes("loops-l3")) ids.push("loop-master");
  if (streak >= 10) ids.push("streak-10");
  if (streak >= 30) ids.push("streak-30");
  return ids;
}

// Concede no Firestore as badges novas que o usuário passou a merecer.
async function syncBadges(ref, data) {
  const deserved = earnedBadges(data);
  const current = data.badges || [];
  const fresh = deserved.filter((b) => !current.includes(b));
  if (fresh.length) {
    await updateDoc(ref, { badges: arrayUnion(...fresh) });
    data.badges = [...current, ...fresh];
  }
  return data;
}

// Carrega (ou cria) o documento do usuário e atualiza o streak diário.
export async function loadUserData(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await withTimeout(getDoc(ref), 8000, "leitura do perfil");
  const today = todayStr();

  if (!snap.exists()) {
    const initial = {
      name: user.displayName || user.email?.split("@")[0] || "Dev",
      email: user.email || "",
      ...defaults(),
      lastActiveDate: today,
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, initial);
    return initial;
  }

  const data = { ...defaults(), ...snap.data() };
  // streak diário: +1 se entrou ontem, reset se pulou dia(s)
  if (data.lastActiveDate && data.lastActiveDate !== today) {
    const gap = daysBetween(data.lastActiveDate, today);
    data.streak = gap === 1 ? (data.streak || 0) + 1 : 1;
    data.lastActiveDate = today;
    await updateDoc(ref, { streak: data.streak, lastActiveDate: today });
  }
  return syncBadges(ref, data);
}

// Concede XP por concluir uma lição (só na primeira vez) e atualiza o progresso do tópico.
export async function awardLessonXp(user, { lessonId, xp, topic, topicPct }) {
  const ref = doc(db, "users", user.uid);
  const update = {
    xp: increment(xp),
    completedLessons: arrayUnion(lessonId),
    lastActiveDate: todayStr(),
  };
  if (topic && typeof topicPct === "number") update[`topicProgress.${topic}`] = topicPct;
  await updateDoc(ref, update);
  const snap = await getDoc(ref);
  const data = { ...defaults(), ...snap.data() };
  return syncBadges(ref, data);
}
