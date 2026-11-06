import { useCallback, useEffect, useState } from 'react'
import { getPushConfig } from '../api/pushApi'
import { disablePush, enablePush, isIOS, isPushOn, isPushSupported, isStandalone } from './pwa'

// Where push stands on this device, for the switches that turn it on:
// - hidden: the server has no keys, so there's nothing to offer
// - ios-install: an iPhone in Safari; push needs the home-screen app first
// - unsupported: this browser can't receive push at all
// - blocked: the person said "Block"; only the phone's settings can undo it
// - off / on: the switch itself
export type PushState = 'loading' | 'hidden' | 'ios-install' | 'unsupported' | 'blocked' | 'off' | 'on'

export function usePush() {
  const [state, setState] = useState<PushState>('loading')
  const [publicKey, setPublicKey] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const config = await getPushConfig().catch(() => null)
      if (cancelled) return
      if (!config?.enabled) return setState('hidden')
      setPublicKey(config.public_key)
      if (!isPushSupported()) return setState(isIOS() && !isStandalone() ? 'ios-install' : 'unsupported')
      if (Notification.permission === 'denied') return setState('blocked')
      const on = await isPushOn().catch(() => false)
      if (!cancelled) setState(on ? 'on' : 'off')
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const turnOn = useCallback(async () => {
    setFailed(false)
    setIsBusy(true)
    try {
      const permission = await enablePush(publicKey)
      setState(permission === 'granted' ? 'on' : permission === 'denied' ? 'blocked' : 'off')
    } catch {
      setFailed(true)
    } finally {
      setIsBusy(false)
    }
  }, [publicKey])

  const turnOff = useCallback(async () => {
    setFailed(false)
    setIsBusy(true)
    try {
      await disablePush()
      setState('off')
    } catch {
      setFailed(true)
    } finally {
      setIsBusy(false)
    }
  }, [])

  return { state, isBusy, failed, turnOn, turnOff }
}
