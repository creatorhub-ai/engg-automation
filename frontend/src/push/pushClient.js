// frontend/src/push/pushClient.js
// Native push + local-notification wiring for the Capacitor Android app.
//
// On the plain web build every export is a safe no-op, so importing this from
// App.js changes NOTHING about how the website behaves. All native behaviour is
// gated behind Capacitor.isNativePlatform().

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { App as CapApp } from "@capacitor/app";
import api from "../api";

const isNative = () => Capacitor.isNativePlatform();

// Remember the current device token so we can unregister it on logout.
let currentToken = null;
let listenersBound = false;

/**
 * Show a local notification. Used to surface FCM messages that arrive while the
 * app is in the FOREGROUND (Android suppresses the tray banner in that case),
 * and to schedule on-device reminders.
 */
async function showLocalNotification({ title, body, id, at, extra }) {
  if (!isNative()) return;
  try {
    const notification = {
      id: id || Math.floor(Math.random() * 2147483000),
      title: title || "Notification",
      body: body || "",
      smallIcon: "ic_stat_icon_config_sample",
      channelId: "default",
      extra: extra || {},
    };
    if (at instanceof Date) notification.schedule = { at };
    await LocalNotifications.schedule({ notifications: [notification] });
  } catch (e) {
    console.warn("[push] local notification failed:", e?.message);
  }
}

/** Create the Android notification channel so heads-up alerts work when closed. */
async function ensureChannel() {
  if (!isNative()) return;
  try {
    await LocalNotifications.createChannel({
      id: "default",
      name: "General",
      description: "Reminders and updates",
      importance: 5, // IMPORTANCE_HIGH -> heads-up banner + sound
      visibility: 1,
      sound: "default",
      vibration: true,
    });
  } catch (e) {
    console.warn("[push] createChannel failed:", e?.message);
  }
}

async function registerTokenWithBackend(token, email) {
  try {
    currentToken = token;
    await api.post("/api/push/register", {
      token,
      email,
      platform: Capacitor.getPlatform(),
    });
    console.log("[push] token registered with backend");
  } catch (e) {
    console.warn("[push] backend token register failed:", e?.message);
  }
}

/**
 * Initialise push. Call once the user is logged in, passing their email so the
 * backend knows which device belongs to which account.
 * @param {{email:string}} user
 */
export async function initPush(user) {
  if (!isNative()) return;
  const email = user?.email;
  if (!email) return;

  await ensureChannel();

  // Ask permission for both push and local notifications (Android 13+ prompt).
  try {
    const localPerm = await LocalNotifications.requestPermissions();
    let pushPerm = await PushNotifications.checkPermissions();
    if (pushPerm.receive === "prompt") {
      pushPerm = await PushNotifications.requestPermissions();
    }
    if (pushPerm.receive !== "granted") {
      console.warn("[push] push permission not granted:", pushPerm.receive);
      return;
    }
    void localPerm;
  } catch (e) {
    console.warn("[push] permission request failed:", e?.message);
    return;
  }

  // Bind listeners only once for the app lifetime.
  if (!listenersBound) {
    listenersBound = true;

    PushNotifications.addListener("registration", (tokenResult) => {
      // TEMP (remove after testing): print the FCM token so it can be read
      // from Android Studio Logcat (filter tag: Capacitor/Console).
      console.log("[push] FCM_TOKEN=" + tokenResult.value);
      registerTokenWithBackend(tokenResult.value, email);
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("[push] registration error:", JSON.stringify(err));
    });

    // Fired when a push arrives while the app is OPEN/foreground.
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      showLocalNotification({
        title: notification.title || notification.data?.title || "Update",
        body: notification.body || notification.data?.body || "",
        extra: notification.data || {},
      });
    });

    // Fired when the user taps a notification (from tray, even when closed).
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const data = action.notification?.data || {};
      console.log("[push] notification tapped:", JSON.stringify(data));
      // Deep-linking hook: navigate based on data.type if desired.
    });
  }

  // Kick off registration -> triggers the "registration" listener with the token.
  try {
    await PushNotifications.register();
  } catch (e) {
    console.warn("[push] register() failed:", e?.message);
  }
}

/**
 * Schedule a local reminder on the device. Fires even if the app is closed.
 * @param {{title:string, body:string, at:Date, id?:number, extra?:object}} opts
 */
export async function scheduleReminder(opts) {
  await ensureChannel();
  return showLocalNotification(opts);
}

/** Cancel a previously scheduled local reminder by id. */
export async function cancelReminder(id) {
  if (!isNative() || id == null) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch (e) {
    console.warn("[push] cancelReminder failed:", e?.message);
  }
}

/** Call on logout so this device stops receiving the user's notifications. */
export async function teardownPush() {
  if (!isNative()) return;
  try {
    if (currentToken) {
      await api.post("/api/push/unregister", { token: currentToken });
    }
    await PushNotifications.removeAllListeners();
    listenersBound = false;
    currentToken = null;
  } catch (e) {
    console.warn("[push] teardown failed:", e?.message);
  }
}

/** Make the Android hardware back button minimise the app instead of closing it. */
export function bindHardwareBack() {
  if (!isNative()) return;
  try {
    CapApp.addListener("backButton", ({ canGoBack }) => {
      if (!canGoBack) CapApp.minimizeApp();
      else window.history.back();
    });
  } catch (e) {
    console.warn("[push] backButton bind failed:", e?.message);
  }
}
