/* eslint-disable react-refresh/only-export-components -- arquivo de contexto: expõe o Provider junto do hook useAuth e do utilitário de mensagens (padrão comum em apps React) */
// ─── Auth context ─────────────────────────────────────────────────────────────
// Expõe o usuário logado e as ações de login/cadastro/logout para todo o app.
import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider, firebaseEnabled } from "./firebase";
import { loadUserData, emptyUserData } from "./userData";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null); // progresso vindo do Firestore
  const [loading, setLoading] = useState(firebaseEnabled); // só "carrega" se o Firebase estiver ligado

  useEffect(() => {
    if (!firebaseEnabled) return; // modo demo: loading já inicia como false
    // dispara sempre que o usuário entra/sai (e ao recarregar a página)
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try { setUserData(await loadUserData(u)); }
        catch (e) { console.error("Erro ao carregar dados do usuário:", e.message); setUserData(emptyUserData(u)); }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signup(name, email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    // usa o objeto real do Firebase (com displayName já atualizado),
    // em vez de um spread que perderia métodos/getters do User.
    setUser(auth.currentUser);
    return cred.user;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function loginWithGoogle() {
    return signInWithPopup(auth, googleProvider);
  }

  function logout() {
    return signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, userData, setUserData, loading, signup, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Traduz os códigos de erro do Firebase para mensagens em pt-BR.
export function authErrorMessage(code) {
  const map = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/missing-password": "Digite uma senha.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/email-already-in-use": "Esse e-mail já está cadastrado. Tente entrar.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-not-found": "Usuário não encontrado. Crie uma conta.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/too-many-requests": "Muitas tentativas. Tente novamente em instantes.",
    "auth/popup-closed-by-user": "Login com Google cancelado.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
  };
  return map[code] || "Algo deu errado. Tente novamente.";
}
