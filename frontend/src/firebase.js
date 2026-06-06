// ─── Firebase initialization ──────────────────────────────────────────────────
// A config vem de variáveis de ambiente (arquivo .env, prefixo VITE_).
// IMPORTANTE: estas chaves são PÚBLICAS (de cliente) — é seguro expô-las no
// frontend. A segurança real vem do Firebase Auth + Firestore Security Rules,
// não de esconder estas chaves. (Doc oficial confirma isso.)
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Só liga o Firebase se as chaves essenciais existirem — assim o app continua
// rodando em "modo demo" (sem login) enquanto você não configura nada.
export const firebaseEnabled = Boolean(config.apiKey && config.projectId && config.appId);

let auth = null;
let db = null;
let googleProvider = null;

if (firebaseEnabled) {
  const app = initializeApp(config);
  auth = getAuth(app);
  // auto-detecta long-polling: melhora a conexão em redes/ambientes que
  // bloqueiam o transporte de streaming padrão do Firestore.
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  googleProvider = new GoogleAuthProvider();
}

export { auth, db, googleProvider };
