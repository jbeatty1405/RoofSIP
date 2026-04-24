import { createClient } from '@/app/_lib/supabase/server'
import TemplateEditor from './TemplateEditor'

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('pm_name, company_name')
    .eq('id', user!.id)
    .single()

  const { data: templates } = await supabase
    .from('sms_templates')
    .select('*')
    .eq('roofer_id', user!.id)
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Message Templates</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Customize the SMS messages sent to homeowners after storm alerts. Use variables to personalize each message.
        </p>
      </div>

      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-8">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Available variables</p>
        <div className="flex gap-2 flex-wrap">
          {['{{first_name}}', '{{pm_name}}', '{{company_name}}', '{{storm_type}}', '{{zip_code}}'].map(v => (
            <code key={v} className="text-xs bg-white border border-zinc-200 text-sky-600 px-2 py-1 rounded-md font-mono">{v}</code>
          ))}
        </div>
      </div>

      <TemplateEditor
        userId={user!.id}
        templates={templates ?? []}
        pmName={profile?.pm_name ?? ''}
        companyName={profile?.company_name ?? ''}
      />
    </div>
  )
}
