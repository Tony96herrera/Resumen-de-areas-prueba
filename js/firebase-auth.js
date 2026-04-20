import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: window.__APP_CONFIG__?.firebaseApiKey || "REEMPLAZA_FIREBASE_API_KEY",
  authDomain: window.__APP_CONFIG__?.firebaseAuthDomain || "REEMPLAZA_FIREBASE_AUTH_DOMAIN",
  projectId: window.__APP_CONFIG__?.firebaseProjectId || "REEMPLAZA_FIREBASE_PROJECT_ID",
  storageBucket: window.__APP_CONFIG__?.firebaseStorageBucket || "REEMPLAZA_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: window.__APP_CONFIG__?.firebaseMessagingSenderId || "REEMPLAZA_FIREBASE_MESSAGING_SENDER_ID",
  appId: window.__APP_CONFIG__?.firebaseAppId || "REEMPLAZA_FIREBASE_APP_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const googleButton = document.getElementById("googleLogin");
const microsoftButton = document.getElementById("microsoftLogin");
const forgotPasswordLink = document.getElementById("forgotPassword");
const formMessage = document.getElementById("formMessage");
const loginButton = document.getElementById("loginButton");

const googleProvider = new GoogleAuthProvider();
const microsoftProvider = new OAuthProvider("microsoft.com");

if (window.location.protocol === "file:") {
  console.warn("La autenticación OAuth no funcionará correctamente abriendo el HTML directamente desde disco. Usa Netlify o un servidor local.");
}

async function ensurePersistence() {
  await setPersistence(auth, browserLocalPersistence);
}

function setLoading(isLoading) {
  loginForm.classList.toggle("loading", isLoading);
  loginButton.textContent = isLoading ? "Validando..." : "Iniciar sesión";
}

function showMessage(message, type = "error") {
  formMessage.textContent = message;
  formMessage.className = `form-message ${type}`;
}

function clearMessage() {
  formMessage.textContent = "";
  formMessage.className = "form-message";
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function checkAllowlist(user) {
  const email = normalizeEmail(user.email || "");

  if (!email) {
    throw new Error("No se pudo validar tu correo.");
  }

  const allowDocRef = doc(db, "allowedUsers", email);
  const allowDoc = await getDoc(allowDocRef);

  if (!allowDoc.exists()) {
    await signOut(auth);
    throw new Error("Tu cuenta no está autorizada para acceder a la plataforma.");
  }

  const allowData = allowDoc.data();

  if (allowData.active === false) {
    await signOut(auth);
    throw new Error("Tu acceso está desactivado. Contacta con administración.");
  }

  return allowData;
}

function resolveRedirectByRole(allowData) {
  if (allowData?.redirectPath) return allowData.redirectPath;
  return "./app.html";
}

async function finishLogin(user) {
  const allowData = await checkAllowlist(user);
  showMessage("Acceso autorizado. Redirigiendo...", "success");
  window.location.href = resolveRedirectByRole(allowData);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value;

  if (!email || !password) {
    showMessage("Introduce tu correo y tu contraseña.");
    return;
  }

  try {
    setLoading(true);
    await ensurePersistence();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await finishLogin(credential.user);
  } catch (error) {
    handleAuthError(error);
  } finally {
    setLoading(false);
  }
});

googleButton.addEventListener("click", async () => {
  clearMessage();
  try {
    setLoading(true);
    await ensurePersistence();
    const credential = await signInWithPopup(auth, googleProvider);
    await finishLogin(credential.user);
  } catch (error) {
    handleAuthError(error);
  } finally {
    setLoading(false);
  }
});

microsoftButton.addEventListener("click", async () => {
  clearMessage();
  try {
    setLoading(true);
    await ensurePersistence();
    const credential = await signInWithPopup(auth, microsoftProvider);
    await finishLogin(credential.user);
  } catch (error) {
    handleAuthError(error);
  } finally {
    setLoading(false);
  }
});

forgotPasswordLink.addEventListener("click", async (event) => {
  event.preventDefault();
  clearMessage();

  const email = normalizeEmail(emailInput.value);
  if (!email) {
    showMessage("Escribe primero tu correo para enviarte el restablecimiento.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMessage("Te hemos enviado un correo para restablecer la contraseña.", "success");
  } catch (error) {
    handleAuthError(error);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    await finishLogin(user);
  } catch (error) {
    handleAuthError(error);
  }
});

function handleAuthError(error) {
  console.error(error);

  const code = error?.code || "";

  const errorMessages = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/user-not-found": "No existe ninguna cuenta con ese correo.",
    "auth/wrong-password": "La contraseña no es correcta.",
    "auth/popup-closed-by-user": "Has cerrado la ventana de acceso antes de terminar.",
    "auth/account-exists-with-different-credential": "Ese correo ya existe con otro método de acceso.",
    "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase Authentication.",
    "auth/invalid-email": "El formato del correo no es válido.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
    "auth/operation-not-supported-in-this-environment": "Este acceso no funciona abriendo el HTML desde tu disco local. Prueba desde Netlify.",
    "auth/operation-not-allowed": "Microsoft no está activado en Firebase Authentication.",
    "auth/invalid-app-credential": "Microsoft necesita configuración completa en Firebase (client ID, secret y dominio autorizado).",
    "auth/popup-blocked": "El navegador bloqueó la ventana emergente. Permite popups e inténtalo otra vez.",
    "auth/cancelled-popup-request": "Se canceló la solicitud de popup anterior. Vuelve a intentarlo.",
  };

  showMessage(errorMessages[code] || error.message || "No se pudo iniciar sesión.");
}
