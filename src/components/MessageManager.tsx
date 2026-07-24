'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, RotateCcw, Save } from 'lucide-react'
import { TEMPLATE_VARIABLES, getDefaultTemplateBody, renderTemplate } from '@/lib/messages'
import { formatDate } from '@/lib/dates'
import type { MessageTemplate } from '@/lib/types'

// Admin control over every message employees send to students. Editing here
// changes what the WhatsApp/copy buttons on the referrer dashboard prefill -
// there is no other copy of this text in the app.
export default function MessageManager({ templates }: { templates: MessageTemplate[] }) {
  const [list, setList] = useState(templates)
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(templates.map((template) => [template.key, template.body])),
  )
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  const sampleVars = Object.fromEntries(TEMPLATE_VARIABLES.map((variable) => [variable.token, variable.sample]))

  const save = async (key: string) => {
    setBusyKey(key)
    setError('')
    setSavedKey(null)
    try {
      const response = await fetch('/api/admin/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, body: drafts[key] ?? '' }),
      })
      const data = (await response.json()) as { template?: MessageTemplate; error?: string }
      if (!response.ok || !data.template) throw new Error(data.error || 'Something went wrong')
      setList((prev) => prev.map((template) => (template.key === key ? data.template! : template)))
      setSavedKey(key)
      setTimeout(() => setSavedKey((current) => (current === key ? null : current)), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="card fade-in-delay-1">
      <p>
        Use these placeholders anywhere in a message — each one is swapped for the real value when an employee sends it.
      </p>

      <div className="variable-legend">
        {TEMPLATE_VARIABLES.map((variable) => (
          <span key={variable.token} className="variable-chip" title={variable.label}>
            {`{{${variable.token}}}`} <small>{variable.label}</small>
          </span>
        ))}
      </div>

      {error ? (
        <div className="error-banner">
          <AlertCircle size={16} /> {error}
        </div>
      ) : null}

      {list.map((template) => {
        const draft = drafts[template.key] ?? ''
        const dirty = draft !== template.body
        const isDefault = draft === getDefaultTemplateBody(template.key)
        return (
          <div key={template.key} className="template-block">
            <div className="template-head">
              <div>
                <h3>{template.title}</h3>
                <p>{template.description}</p>
              </div>
              <small className="muted-cell">
                Updated {formatDate(template.updated_at)}
                {template.updated_by_name ? ` by ${template.updated_by_name}` : ''}
              </small>
            </div>

            <textarea
              value={draft}
              rows={template.key === 'copy_share' ? 3 : 7}
              onChange={(event) => setDrafts((prev) => ({ ...prev, [template.key]: event.target.value }))}
              placeholder={template.key === 'employee_notice' ? 'Leave blank to hide the banner' : ''}
            />

            <div className="template-actions">
              <button className="primary" onClick={() => save(template.key)} disabled={!dirty || busyKey === template.key}>
                {busyKey === template.key ? (
                  <>
                    <span className="spinner" /> Saving…
                  </>
                ) : (
                  <>
                    <Save size={16} /> Save
                  </>
                )}
              </button>
              <button
                className="secondary"
                onClick={() => setDrafts((prev) => ({ ...prev, [template.key]: getDefaultTemplateBody(template.key) }))}
                disabled={isDefault}
              >
                <RotateCcw size={16} /> Reset to default
              </button>
              {savedKey === template.key ? (
                <span className="availability-msg ok">
                  <CheckCircle2 size={15} /> Saved — live for every employee.
                </span>
              ) : null}
            </div>

            {draft.trim() ? (
              <div className="template-preview">
                <span className="template-preview-label">Preview</span>
                {renderTemplate(draft, sampleVars)}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
