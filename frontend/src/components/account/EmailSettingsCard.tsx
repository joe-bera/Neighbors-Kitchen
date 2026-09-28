import { useState } from 'react'
import { updateEmailSettings } from '../../services/accountService'
import type { EmailSettings } from '../../types/notification.types'
import { getApiError } from '../../utils/apiError'
import Toggle from '../common/Toggle'

type SettingKey = keyof EmailSettings

const SETTINGS: { key: SettingKey; label: string; hint: string; chefsOnly?: boolean }[] = [
  { key: 'rateReminders', label: 'Rate-your-meal reminders', hint: 'An email a couple of hours after an order is done.' },
  { key: 'dishRequestNews', label: 'Answers to my dish requests', hint: 'When a chef answers your request, or says yes to a dish you voted for.' },
  { key: 'kitchenFeedback', label: 'New reviews and dish requests', hint: 'When a customer reviews one of your meals or asks for a dish.', chefsOnly: true },
]

interface EmailSettingsCardProps {
  initial: EmailSettings
  isChef: boolean
}

/** The optional emails a person can switch off. Each switch saves as soon as it is flipped. */
export default function EmailSettingsCard({ initial, isChef }: EmailSettingsCardProps) {
  const [settings, setSettings] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const change = async (key: SettingKey, value: boolean) => {
    const previous = settings
    setSettings({ ...settings, [key]: value })
    setSaving(true)
    setMessage(null)
    try {
      setSettings(await updateEmailSettings({ [key]: value } as Partial<EmailSettings>))
      setMessage({ kind: 'success', text: 'Saved.' })
    } catch (error) {
      setSettings(previous)
      setMessage({ kind: 'error', text: getApiError(error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card email-settings" id="email-settings" aria-labelledby="email-settings-heading">
      <h2 id="email-settings-heading">Email settings</h2>
      <div className="email-settings-list">
        {SETTINGS.filter((setting) => isChef || !setting.chefsOnly).map((setting) => (
          <div key={setting.key} className="email-setting">
            <Toggle label={setting.label} checked={settings[setting.key]} disabled={saving} onChange={(value) => change(setting.key, value)} />
            <p className="field-hint">{setting.hint}</p>
          </div>
        ))}
      </div>
      <p className="card-note">Order updates and password emails always go out. The bell shows everything.</p>
      {message && (
        <p className={message.kind === 'error' ? 'field-error' : 'email-settings-saved'} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </section>
  )
}
