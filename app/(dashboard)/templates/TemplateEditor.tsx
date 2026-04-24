'use client'

import { createClient } from '@/app/_lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Template = {
  id: string
  name: string
  body: string
  storm_type: string
  active: boolean
}

const STORM_TYPES = ['Any storm', 'Hail', 'Wind', 'Thunderstorm', 'Rain', 'Tornado']

const DEFAULTS = [
  {
    name: 'Storm check-in',
    storm_type: 'Any storm',
    body: "Hey {{first_name}}, this is {{pm_name}} from {{company_name}}. We're seeing {{storm_type}} activity near your home and wanted to check in on your roof. Reply YES for a free inspection — no strings attached.",
  },
  {
    name: 'Hail damage',
    storm_type: 'Hail',
    body: "Hi {{first_name}}, {{pm_name}} here from {{company_name}}. With the recent hail in your area ({{zip_code}}), we want to make sure your roof came through okay. Reply YES and I'll get you on the schedule for a free inspection.",
  },
]

function resolvePreview(body: string, pmName: string, companyName: string) {
  return body
    .replace(/{{first_name}}/g, 'Sarah')
    .replace(/{{pm_name}}/g, pmName || 'Mike')
    .replace(/{{company_name}}/g, companyName || 'Smith Roofing')
    .replace(/{{storm_type}}/g, 'hail')
    .replace(/{{zip_code}}/g, '85701')
}

export default function TemplateEditor({
  userId, templates, pmName, companyName,
}: {
  userId: string
  templates: Template[]
  pmName: string
  companyName: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<Partial<Template> | null>(null)
  const [saving, setSaving] = useState(false)

  async function saveTemplate() {
    if (!editing?.body?.trim() || !editing?.name?.trim()) return
    setSaving(true)
    const supabase = createClient()

    if (editing.id) {
      await supabase.from('sms_templates').update({
        name: editing.name,
        body: editing.body,
        storm_type: editing.storm_type ?? 'Any storm',
        active: editing.active ?? true,
      }).eq('id', editing.id)
    } else {
      await supabase.from('sms_templates').insert({
        roofer_id: userId,
        name: editing.name,
        body: editing.body,
        storm_type: editing.storm_type ?? 'Any storm',
        active: true,
      })
    }

    setSaving(false)
    setEditing(null)
    router.refresh()
  }

  async function deleteTemplate(id: string) {
    const supabase = createClient()
    await supabase.from('sms_templates').delete().eq('id', id)
    router.refresh()
  }

  async function toggleActive(t: Template) {
    const supabase = createClient()
    await supabase.from('sms_templates').update({ active: !t.active }).eq('id', t.id)
    router.refresh()
  }

  async function addDefaults() {
    const supabase = createClient()
    for (const d of DEFAULTS) {
      await supabase.from('sms_templates').insert({ roofer_id: userId, ...d, active: true })
    }
    router.refresh()
  }

  return (
    <div>
      {templates.length === 0 && !editing && (
        <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center mb-6">
          <p className="text-zinc-500 text-sm mb-1">No templates yet.</p>
          <p className="text-zinc-400 text-xs mb-5">Start from scratch or load the default templates.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={addDefaults}
              className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Load default templates
            </button>
            <button
              onClick={() => setEditing({ name: '', body: '', storm_type: 'Any storm', active: true })}
              className="px-4 py-2 border border-zinc-300 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-50 transition-colors"
            >
              Write from scratch
            </button>
          </div>
        </div>
      )}

      {templates.length > 0 && (
        <div className="flex flex-col gap-3 mb-6">
          {templates.map(t => (
            <div key={t.id} className={`bg-white rounded-xl border p-5 transition-colors ${t.active ? 'border-zinc-200' : 'border-zinc-100 opacity-60'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-zinc-900 text-sm">{t.name}</p>
                    <span className="text-xs bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">{t.storm_type}</span>
                    {t.active && <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full">Active</span>}
                  </div>
                  <p className="text-sm text-zinc-600 leading-relaxed">{resolvePreview(t.body, pmName, companyName)}</p>
                  <p className="text-xs text-zinc-400 mt-1">{t.body.length} chars · {Math.ceil(t.body.length / 160)} SMS segment{Math.ceil(t.body.length / 160) !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => toggleActive(t)} className="text-xs text-zinc-400 hover:text-zinc-700 border border-zinc-200 px-2 py-1 rounded-md transition-colors">
                    {t.active ? 'Pause' : 'Activate'}
                  </button>
                  <button onClick={() => setEditing(t)} className="text-xs text-zinc-400 hover:text-zinc-700 border border-zinc-200 px-2 py-1 rounded-md transition-colors">
                    Edit
                  </button>
                  <button onClick={() => deleteTemplate(t.id)} className="text-xs text-red-400 hover:text-red-600 border border-zinc-200 px-2 py-1 rounded-md transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {templates.length > 0 && !editing && (
        <button
          onClick={() => setEditing({ name: '', body: '', storm_type: 'Any storm', active: true })}
          className="w-full border-2 border-dashed border-zinc-200 text-zinc-400 hover:border-sky-300 hover:text-sky-500 rounded-xl py-4 text-sm font-medium transition-colors"
        >
          + Add template
        </button>
      )}

      {editing && (
        <div className="bg-white rounded-xl border border-sky-200 p-6">
          <h2 className="font-semibold text-zinc-900 mb-5">{editing.id ? 'Edit template' : 'New template'}</h2>
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700 mb-1">Template name</label>
                <input
                  type="text"
                  value={editing.name ?? ''}
                  onChange={e => setEditing(t => ({ ...t!, name: e.target.value }))}
                  placeholder="e.g. Hail damage"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Storm type</label>
                <select
                  value={editing.storm_type ?? 'Any storm'}
                  onChange={e => setEditing(t => ({ ...t!, storm_type: e.target.value }))}
                  className="px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {STORM_TYPES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Message body</label>
              <textarea
                value={editing.body ?? ''}
                onChange={e => setEditing(t => ({ ...t!, body: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                placeholder="Hey {{first_name}}, this is {{pm_name}}..."
              />
              <p className="text-xs text-zinc-400 mt-1">{(editing.body ?? '').length} chars · {Math.ceil((editing.body ?? '').length / 160) || 1} SMS segment</p>
            </div>

            {editing.body && (
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Preview</p>
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                  <div className="bg-sky-500 text-white text-sm rounded-2xl rounded-bl-sm px-4 py-2.5 inline-block max-w-xs leading-relaxed">
                    {resolvePreview(editing.body, pmName, companyName)}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={saveTemplate}
                disabled={saving}
                className="flex-1 bg-zinc-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save template'}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
