import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, Loader2, Plus, Send, X } from 'lucide-react'
import { extractErrorMessage } from '../../api/client'
import { getAssistantConversation, sendAssistantMessage, type ChatMessage } from '../../api/assistantApi'
import { canManage } from '../../constants/roles'
import { useAuth } from '../auth/useAuth'
import { ChatMarkdown } from './ChatMarkdown'

// Floating help assistant, mounted once per layout. It answers questions
// about the system and the user's own situation (the backend scopes what it
// can look up to the user's role) and links to the right pages.
export function AssistantWidget({ className = 'bottom-6' }: { className?: string }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || loaded) return
    getAssistantConversation()
      .then((c) => {
        setEnabled(c.enabled)
        setConversationId(c.conversation_id)
        setMessages(c.messages)
      })
      .catch((err) => setError(extractErrorMessage(err, t('assistant.loadError'))))
      .finally(() => setLoaded(true))
  }, [open, loaded, t])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, open])

  if (!user) return null

  const suggestionKeys =
    user.role === 'student'
      ? ['student1', 'student2', 'student3']
      : canManage(user)
        ? ['manager1', 'manager2', 'manager3']
        : user.is_committee_member
          ? ['committee1', 'committee2']
          : ['staff1', 'staff2']

  async function send(text: string) {
    const message = text.trim()
    if (!message || sending) return
    setError(null)
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: message, created_at: new Date().toISOString() }])
    setSending(true)
    try {
      const res = await sendAssistantMessage(conversationId, message)
      setConversationId(res.conversation_id)
      setMessages((m) => [...m, res.reply])
    } catch (err) {
      // The turn wasn't saved server-side; drop the optimistic message and
      // give the text back so it can be resent.
      setMessages((m) => m.slice(0, -1))
      setInput(message)
      setError(extractErrorMessage(err, t('assistant.sendError')))
    } finally {
      setSending(false)
    }
  }

  function newChat() {
    setConversationId(null)
    setMessages([])
    setError(null)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('assistant.open')}
        className={`fixed right-4 z-30 flex h-13 w-13 items-center justify-center rounded-full bg-turquoise-500 text-navy-950 shadow-[var(--shadow-card)] hover:bg-turquoise-400 md:right-6 ${className}`}
      >
        <Bot className="h-6 w-6" />
      </button>
    )
  }

  return (
    <section
      role="dialog"
      aria-label={t('assistant.title')}
      className="fixed inset-x-0 bottom-0 z-40 flex h-[85dvh] flex-col rounded-t-[20px] border border-navy-700 bg-navy-900 shadow-[var(--shadow-card)] md:inset-x-auto md:right-6 md:bottom-6 md:h-[600px] md:max-h-[calc(100dvh-3rem)] md:w-[400px] md:rounded-[20px]"
    >
      <header className="flex items-center gap-2 border-b border-navy-700 px-4 py-3">
        <Bot className="h-5 w-5 text-turquoise-400" />
        <div className="flex-1">
          <p className="text-[15px] font-bold text-sand-100">{t('assistant.title')}</p>
          <p className="text-[11px] text-sand-300">{t('assistant.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={newChat}
          disabled={sending || messages.length === 0}
          title={t('assistant.newChat')}
          aria-label={t('assistant.newChat')}
          className="rounded-lg p-1.5 text-sand-300 hover:bg-navy-800 hover:text-sand-100 disabled:opacity-40"
        >
          <Plus className="h-4.5 w-4.5" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('assistant.close')}
          className="rounded-lg p-1.5 text-sand-300 hover:bg-navy-800 hover:text-sand-100"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </header>

      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 text-sm">
        {!enabled && <p className="text-sand-300">{t('assistant.disabled')}</p>}

        {enabled && loaded && messages.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sand-200">{t('assistant.greeting', { name: user.full_name.split(' ')[0] })}</p>
            <div className="flex flex-col gap-2">
              {suggestionKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => send(t(`assistant.suggestions.${key}`))}
                  className="rounded-xl border border-navy-700 px-3 py-2 text-left text-sand-100 hover:border-turquoise-500 hover:text-turquoise-400"
                >
                  {t(`assistant.suggestions.${key}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-turquoise-500/15 px-3.5 py-2.5 whitespace-pre-wrap text-sand-100 [overflow-wrap:anywhere]">
              {m.text}
            </div>
          ) : (
            <div key={i} className="max-w-[92%] self-start rounded-2xl rounded-bl-md bg-navy-800 px-3.5 py-2.5 text-sand-100 [overflow-wrap:anywhere]">
              <ChatMarkdown text={m.text} onNavigate={() => setOpen(window.matchMedia('(min-width: 768px)').matches)} />
            </div>
          ),
        )}

        {sending && (
          <div className="flex items-center gap-2 self-start text-sand-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('assistant.thinking')}
          </div>
        )}
        {error && <p className="text-clay-400">{error}</p>}
      </div>

      {enabled && (
        <form
          className="flex items-end gap-2 border-t border-navy-700 px-3 py-3"
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
        >
          <textarea
            rows={1}
            value={input}
            maxLength={2000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void send(input)
              }
            }}
            placeholder={t('assistant.placeholder')}
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-navy-700 bg-navy-950 px-3 py-2.5 text-sm text-sand-100 outline-none focus:border-turquoise-400"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label={t('assistant.send')}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-turquoise-500 text-navy-950 hover:bg-turquoise-400 disabled:opacity-40"
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        </form>
      )}
      <p className="px-4 pb-2 text-center text-[10px] text-sand-300">{t('assistant.disclaimer')}</p>
    </section>
  )
}
