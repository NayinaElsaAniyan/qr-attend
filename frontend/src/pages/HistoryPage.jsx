import { API } from '../lib/api'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, Users, Calendar, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function HistoryPage() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [classId])

  async function fetchHistory() {
    try {
      const res = await fetch(`${API}/api/sessions/history/${classId}`)
      const data = await res.json()
      setSessions(data)
    } catch (err) {
      toast.error('Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  function exportSession(sessionId) {
    window.open(`${API}/api/attendance/export/${sessionId}`, '_blank')
    toast.success('CSV downloading...')
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm text-[#999] hover:text-[#111] transition mb-8"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <h1 className="text-xl font-medium text-[#111] mb-1">Session History</h1>
      <p className="text-sm text-[#999] mb-6">All past attendance sessions for this class</p>

      {loading ? (
        <div className="text-center py-16 text-sm text-[#999]">Loading...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[#e8e8e8]">
          <p className="text-sm text-[#999]">No sessions yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session, i) => {
            const date = new Date(session.created_at)
            const dateStr = date.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })
            const timeStr = date.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })

            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between p-4 rounded-2xl bg-white border border-[#e8e8e8]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#f0f0f0] flex items-center justify-center">
                    <Calendar size={16} className="text-[#666]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#111]">{dateStr}</span>
                      <span className="text-xs text-[#999]">{timeStr}</span>
                      {session.is_active && (
                        <span className="text-[10px] bg-[#dcfce7] text-[#166534] px-2 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-[#999]">
                        <Users size={11} /> {session.attendance_count} students
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[#999]">
                        <Clock size={11} /> Token: {session.qr_token}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => exportSession(session.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e8e8e8] text-xs text-[#666] hover:border-[#ccc] transition"
                >
                  <Download size={12} /> Export
                </button>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}