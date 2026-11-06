import { useSyncExternalStore } from 'react'
import { deletePushSubscription, getPushConfig, savePushSubscription } from '../api/pushApi'

// Installing to the home screen and Web Push. The service worker (public/sw.js)
// only shows notifications; nothing here caches the site.

// --- Install ---------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let installPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

// Chrome/Android fires beforeinstallprompt once, early, so it's caught at
// startup and kept until the student taps "install". iOS never fires it.
export function startPwa(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installPrompt = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installPrompt = null
    emit()
  })
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    })
  }
}

export function useCanPromptInstall(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => installPrompt !== null,
  )
}

export async function promptInstall(): Promise<void> {
  const event = installPrompt
  if (!event) return
  await event.prompt()
  await event.userChoice.catch(() => undefined)
  // A prompt can only be used once.
  installPrompt = null
  emit()
}

// Opened from the home-screen icon rather than in a browser tab.
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  // iPadOS reports itself as a Mac, but a Mac has no touch screen.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// --- Push ------------------------------------------------------------------

// Remembers that this person turned push off on this device, so having
// notification permission doesn't quietly turn it back on at the next login.
const OPTED_OUT_KEY = 'student-house-push-opted-out'

function setOptedOut(value: boolean): void {
  try {
    if (value) localStorage.setItem(OPTED_OUT_KEY, '1')
    else localStorage.removeItem(OPTED_OUT_KEY)
  } catch {
    // Private mode: the flag is only a convenience.
  }
}

function isOptedOut(): boolean {
  try {
    return localStorage.getItem(OPTED_OUT_KEY) === '1'
  } catch {
    return false
  }
}

// On iOS this is only true inside the installed app (iOS 16.4+), never in Safari.
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.length) return false
  const view = new Uint8Array(a)
  return view.every((byte, i) => byte === b[i])
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

export async function isPushOn(): Promise<boolean> {
  return Notification.permission === 'granted' && (await currentSubscription()) !== null
}

// Subscribes this device for the signed-in user. Asks for permission first,
// so it must run from a tap: browsers block prompts nobody asked for.
// Returns the permission the browser ended up with.
export async function enablePush(publicKey: string): Promise<NotificationPermission> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission
  await subscribe(publicKey)
  setOptedOut(false)
  return permission
}

async function subscribe(publicKey: string): Promise<void> {
  const registration = await navigator.serviceWorker.ready
  const key = keyBytes(publicKey)
  let subscription = await registration.pushManager.getSubscription()
  // Subscribed under keys the server no longer has: that one can't be used.
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe()
    subscription = null
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  await savePushSubscription(subscription.toJSON())
}

// Stops pushes to this device. remember=false is for logging out: the device
// stops getting this person's notices, but whoever signs in next may get theirs.
export async function disablePush(remember = true): Promise<void> {
  if (remember) setOptedOut(true)
  const subscription = await currentSubscription()
  if (!subscription) return
  await deletePushSubscription(subscription.endpoint).catch(() => undefined)
  await subscription.unsubscribe().catch(() => undefined)
}

// After signing in: if this device already allowed notifications and the
// person didn't turn them off here, subscribe it for them without asking.
export async function resumePush(): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted' || isOptedOut()) return
  const config = await getPushConfig()
  if (config.enabled) await subscribe(config.public_key)
}
