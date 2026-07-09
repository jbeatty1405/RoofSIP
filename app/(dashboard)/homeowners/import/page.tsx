'use client'

import { createClient } from '@/app/_lib/supabase/client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const ADMIN_USER_ID = '759e00cd-34ae-45c7-b56f-e8f8cf4eed36'

type Row = { name: string; address: string; zip: string; phone: string }
type Roofer = { id: string; pm_name?: string; company_name?: string; email?: string }

// Mirrors the server's normalizePhone so the "ready" count matches what imports.
function normPhone(raw: string): string {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return ''
}
function rowIssues(r: Row): string[] {
  const issues: string[] = []
  if (!r.name.trim()) issues.push('name')
  if (!r.address.trim()) issues.push('address')
  if (!/^\d{5}$/.test(r.zip.trim())) issues.push('ZIP')
  if (!normPhone(r.phone)) issues.push('phone')
  return issues
}

export default function ImportPage() {
  const router = useRouter()
  const [stage, setStage] = useState<'input' | 'review' | 'done'>('input')
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [result, setResult] = useState<{ inserted: number; skippedInvalid: number; skippedDupes: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Admin-only: import on behalf of another roofer.
  const [isAdmin, setIsAdmin] = useState(false)
  const [roofers, setRoofers] = useState<Roofer[]>([])
  const [targetRooferId, setTargetRooferId] = useState('')

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id === ADMIN_USER_ID) {
        setIsAdmin(true)
        try {
          const res = await fetch('/api/admin/users')
          if (res.ok) {
            const data = await res.json()
            const list: Roofer[] = (Array.isArray(data) ? data : data.users ?? []).map((u: any) => ({
              id: u.id, pm_name: u.pm_name, company_name: u.company_name, email: u.email,
            }))
            setRoofers(list)
          }
        } catch { /* non-critical */ }
      }
    })()
  }, [])

  async function gridFromFile(file: File): Promise<string[][]> {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' }) as string[][]
  }

  async function gridFromText(text: string): Promise<string[][]> {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(text, { type: 'string' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' }) as string[][]
  }

  async function handleParse(grid: string[][]) {
    if (!grid || grid.length === 0) { setError('Nothing to read in that list.'); return }
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/homeowners/import/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grid }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not read that list.'); return }
      const parsed: Row[] = (data.rows ?? []).map((r: any) => ({
        name: r.row.name ?? '', address: r.row.address ?? '', zip: r.row.zip ?? '', phone: r.row.phone ?? '',
      }))
      if (parsed.length === 0) { setError('No homeowners found in that list.'); return }
      setRows(parsed)
      setStage('review')
    } catch {
      setError('Something went wrong reading that list.')
    } finally {
      setBusy(false)
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setError('')
    try {
      const grid = await gridFromFile(file)
      await handleParse(grid)
    } catch {
      setError('Could not read that file. Try a .xlsx or .csv export.')
      setBusy(false)
    }
  }

  async function onPaste() {
    if (!pasted.trim()) { setError('Paste your list first.'); return }
    setBusy(true); setError('')
    try {
      const grid = await gridFromText(pasted)
      await handleParse(grid)
    } catch {
      setError('Could not read that text.')
      setBusy(false)
    }
  }

  function updateRow(i: number, field: keyof Row, value: string) {
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }
  function removeRow(i: number) {
    setRows(rs => rs.filter((_, idx) => idx !== i))
  }

  const goodRows = rows.filter(r => rowIssues(r).length === 0)

  async function onCommit() {
    if (goodRows.length === 0) { setError('No complete rows to import yet.'); return }
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/homeowners/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: goodRows, targetRooferId: isAdmin && targetRooferId ? targetRooferId : undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Import failed.'); return }
      setResult(data)
      setStage('done')
    } catch {
      setError('Import failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link href="/homeowners" className="text-sm text-zinc-500 hover:text-zinc-300">← Homeowners</Link>
        <h1 className="text-2xl font-bold text-white mt-2">Import your list</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Drop in a spreadsheet or paste any list of homeowners. Everything you import is added as{' '}
          <span className="text-amber-400 font-medium">monitor-only</span> — SIP watches every address for storms and
          flags the hits as Hot Leads, but it never texts them. No opt-in texts go out.
        </p>
      </div>

      {error && (
        <div className="mb-5 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {isAdmin && (
        <div className="mb-5 bg-sky-500/5 border border-sky-500/20 rounded-lg px-4 py-3">
          <label className="block text-xs font-semibold text-sky-400 uppercase tracking-wide mb-2">Admin · import on behalf of</label>
          <select
            value={targetRooferId}
            onChange={e => setTargetRooferId(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200"
          >
            <option value="">Myself</option>
            {roofers.map(r => (
              <option key={r.id} value={r.id}>{r.company_name || r.pm_name || r.email || r.id}</option>
            ))}
          </select>
        </div>
      )}

      {stage === 'input' && (
        <div className="space-y-5">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <h2 className="text-sm font-semibold text-zinc-200 mb-1">Upload a file</h2>
            <p className="text-xs text-zinc-500 mb-4">Excel (.xlsx, .xls) or CSV. Any column names — we figure out which is which.</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt,text/csv"
              onChange={onFile}
              disabled={busy}
              className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-500 file:text-white hover:file:bg-sky-600 file:cursor-pointer disabled:opacity-50"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-600">
            <div className="h-px bg-zinc-800 flex-1" /> OR <div className="h-px bg-zinc-800 flex-1" />
          </div>

          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <h2 className="text-sm font-semibold text-zinc-200 mb-1">Paste a list</h2>
            <p className="text-xs text-zinc-500 mb-4">Copy rows straight out of Excel, Google Sheets, your notes, an email — whatever you've got.</p>
            <textarea
              value={pasted}
              onChange={e => setPasted(e.target.value)}
              placeholder={'John Smith    123 W Main St    85383    602-555-1234\nJane Doe    456 E Oak Ave    85226    480-555-9876'}
              rows={7}
              disabled={busy}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-200 font-mono placeholder:text-zinc-700 disabled:opacity-50"
            />
            <button
              onClick={onPaste}
              disabled={busy || !pasted.trim()}
              className="mt-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {busy ? 'Reading…' : 'Read this list'}
            </button>
          </div>
        </div>
      )}

      {stage === 'review' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-zinc-400">
              <span className="text-green-400 font-semibold">{goodRows.length}</span> ready
              {rows.length - goodRows.length > 0 && (
                <span className="text-amber-400"> · {rows.length - goodRows.length} need a fix</span>
              )}
            </p>
            <button onClick={() => { setStage('input'); setRows([]) }} className="text-xs text-zinc-500 hover:text-zinc-300">Start over</button>
          </div>

          <p className="text-xs text-zinc-600 mb-3">Fix or delete any highlighted rows. A row needs a name, street address, 5-digit ZIP, and a 10-digit phone. Only complete rows import.</p>

          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/50 text-left text-xs text-zinc-500 uppercase tracking-wide">
                  <th className="px-3 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Address</th>
                  <th className="px-3 py-2.5 font-medium">ZIP</th>
                  <th className="px-3 py-2.5 font-medium">Phone</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const issues = rowIssues(r)
                  const bad = (f: string) => issues.includes(f) ? 'border-amber-500/50 bg-amber-500/5' : 'border-zinc-800'
                  return (
                    <tr key={i} className="border-b border-zinc-800 last:border-0">
                      <td className="px-2 py-1.5"><input value={r.name} onChange={e => updateRow(i, 'name', e.target.value)} className={`w-36 bg-zinc-950 border rounded px-2 py-1.5 text-zinc-200 ${bad('name')}`} /></td>
                      <td className="px-2 py-1.5"><input value={r.address} onChange={e => updateRow(i, 'address', e.target.value)} className={`w-56 bg-zinc-950 border rounded px-2 py-1.5 text-zinc-200 ${bad('address')}`} /></td>
                      <td className="px-2 py-1.5"><input value={r.zip} onChange={e => updateRow(i, 'zip', e.target.value)} className={`w-20 bg-zinc-950 border rounded px-2 py-1.5 text-zinc-200 ${bad('ZIP')}`} /></td>
                      <td className="px-2 py-1.5"><input value={r.phone} onChange={e => updateRow(i, 'phone', e.target.value)} className={`w-36 bg-zinc-950 border rounded px-2 py-1.5 text-zinc-200 ${bad('phone')}`} /></td>
                      <td className="px-2 py-1.5 text-right"><button onClick={() => removeRow(i)} className="text-zinc-600 hover:text-red-400 text-xs px-2">Remove</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={onCommit}
              disabled={busy || goodRows.length === 0}
              className="bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              {busy ? 'Importing…' : `Import ${goodRows.length} as monitor-only`}
            </button>
            <span className="text-xs text-zinc-600">No texts go out. You can add consented homeowners individually later.</span>
          </div>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center">
          <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p className="text-white font-semibold">{result.inserted} roof{result.inserted === 1 ? '' : 's'} now being watched</p>
          <p className="text-zinc-500 text-sm mt-1">
            Added as monitor-only.
            {result.skippedDupes > 0 && ` ${result.skippedDupes} already on the account.`}
            {result.skippedInvalid > 0 && ` ${result.skippedInvalid} skipped as incomplete.`}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button onClick={() => router.push('/homeowners')} className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">See homeowners</button>
            <button onClick={() => { setStage('input'); setRows([]); setPasted(''); setResult(null) }} className="text-sm text-zinc-500 hover:text-zinc-300">Import another list</button>
          </div>
        </div>
      )}
    </div>
  )
}
