import { API } from '../lib/api'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, QrCode } from 'lucide-react'

export default function MarkAttendance() {
  const { token } = useParams()
  const [form, setForm] = useState({ student_name: '', student_email: '' })
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch(`${API}/attendance/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_token: token,
          student_name: form.student_name,
          student_email: form.student_email,
        })
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('success')
        setMessage("Attendance marked! You're all set.")
      } else {
        setStatus('error')
        setMessage(data.detail || 'Something went wrong')
      }
    } catch (err) {
      setStatus('error')
      setMessage('Network error. Check your connection.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#fafafa]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-8 h-8 rounded-lg bg-[#111] flex items-center justify-center">
            <QrCode size={16} className="text-white" />
          </div>
          <span className="text-lg font-medium text-[#111]">QR Attend</span>
        </div>

        {status === 'success' ? (
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="text-center p-8 rounded-2xl border-2 border-[#22c55e] bg-white"
          >
            <div className="w-16 h-16 rounded-full bg-[#f0fdf4] border-2 border-[#22c55e] flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-[#22c55e]" />
            </div>
            <h2 className="text-xl font-medium text-[#111] mb-1">You're in!</h2>
            <p className="text-sm text-[#999]">{message}</p>
          </motion.div>
        ) : status === 'error' ? (
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="text-center p-8 rounded-2xl border border-[#fca5a5] bg-white"
          >
            <XCircle size={48} className="mx-auto mb-4 text-[#ef4444]" />
            <h2 className="text-xl font-medium text-[#111] mb-1">Oops</h2>
            <p className="text-sm text-[#999] mb-4">{message}</p>
            <button
              onClick={() => setStatus('idle')}
              className="px-5 py-2 rounded-lg bg-[#111] text-white text-sm font-medium"
            >
              Try again
            </button>
          </motion.div>
        ) : (
          <div className="p-8 rounded-2xl border border-[#e8e8e8] bg-white">
            <h2 className="text-lg font-medium text-[#111] mb-1 text-center">Mark attendance</h2>
            <p className="text-xs text-[#999] mb-6 text-center">
              Session: <code className="font-mono text-[#111]">{token}</code>
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] text-[#999] block mb-1">Full name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={form.student_name}
                  onChange={e => setForm({ ...form, student_name: e.target.value })}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-[#e8e8e8] text-sm text-[#111] placeholder:text-[#ccc]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#999] block mb-1">University email</label>
                <input
                  type="email"
                  placeholder="jdoe@temple.edu"
                  value={form.student_email}
                  onChange={e => setForm({ ...form, student_email: e.target.value })}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-[#e8e8e8] text-sm text-[#111] placeholder:text-[#ccc]"
                />
              </div>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-3 rounded-xl bg-[#111] text-white font-medium text-sm disabled:opacity-50"
              >
                {status === 'loading' ? 'Marking...' : "I'm here!"}
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  )
}