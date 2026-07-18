// frontend/src/push/webPush.js
// Web Push (FCM for browsers) so the WEB app shows Gmail-style notifications,
// even when the tab is closed. On the native Capacitor app this is a no-op —
// pushClient.js (the native plugin) handles that case instead.
//
// The backend stores web tokens in the same device_tokens table and
// sendPushToEmails() delivers to them automatically (FCM handles any token).

import { Capacitor } from "@capacitor/core";
import api from "../api";

// Firebase web config is PUBLIC. Values fall back to this project's known
// config; override via REACT_APP_* env vars if needed. You MUST set the
// Web appId and the VAPID key (from Firebase Console) for web push to work.
const firebaseConfig = {
  apiKey:
    process.env.REACT_APP_FIREBASE_API_KEY ||
    "AIzaSyC0f13VfYnKe6rcltOiauhWH8_nDMWdj5k",
  authDomain:
    process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "ce0001.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "ce0001",
  storageBucket:
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "ce0001.firebasestorage.app",
  messagingSenderId:
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "539364596262",
  appId:
    process.env.REACT_APP_FIREBASE_APP_ID ||
    "1:539364596262:web:459c2f777d1167d08064e7",
};

// Web Push certificate "key pair" from Firebase Console ->
// Project settings -> Cloud Messaging -> Web configuration.
const VAPID_KEY =
  process.env.REACT_APP_FIREBASE_VAPID_KEY || "YOUR_WEB_PUSH_VAPID_KEY";

let webToken = null;

/**
 * Register the browser for web push and send the token to the backend.
 * Safe to call anywhere — quietly returns on native, unsupported browsers,
 * missing config, or denied permission.
 * @param {{email:string}} user
 */
export async function initWebPush(user) {
  if (Capacitor.isNativePlatform()) return; // native handled by pushClient.js
  const email = user?.email;
  if (!email) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (!firebaseConfig.appId || firebaseConfig.appId.startsWith("YOUR_")) {
    console.warn("[webpush] Firebase Web appId not set; skipping web push.");
    return;
  }
  if (!VAPID_KEY || VAPID_KEY.startsWith("YOUR_")) {
    console.warn("[webpush] VAPID key not set; skipping web push.");
    return;
  }

  try {
    const { initializeApp, getApps } = await import("firebase/app");
    const { isSupported, getMessaging, getToken, onMessage } = await import(
      "firebase/messaging"
    );
    if (!(await isSupported())) return;

    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      console.warn("[webpush] notification permission not granted:", perm);
      return;
    }

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) {
      console.warn("[webpush] no token returned");
      return;
    }
    webToken = token;
    console.log("[webpush] WEB_TOKEN=" + token);
    await api.post("/api/push/register", { token, email, platform: "web" });

    // Foreground messages don't auto-display — show them manually.
    onMessage(messaging, (payload) => {
      const n = payload.notification || {};
      if (Notification.permission === "granted") {
        new Notification(n.title || "Notification", {
          body: n.body || "",
          icon: "/logo192.png",
        });
      }
    });
  } catch (e) {
    console.warn("[webpush] init failed:", e?.message);
  }
}

/** Called on logout so this browser stops receiving the user's notifications. */
export async function teardownWebPush() {
  try {
    if (webToken) {
      await api.post("/api/push/unregister", { token: webToken });
      webToken = null;
    }
  } catch (e) {
    console.warn("[webpush] teardown failed:", e?.message);
  }
}
