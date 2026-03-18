import { API } from '../lib/api'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Download, RefreshCw, Users, Clock, Wifi, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function SessionView() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [qrData, setQrData] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [timeLeft, setTimeLeft] = useState(null)
  const [isExpired, setIsExpired] = useState(false)
  const [totalStudents, setTotalStudents] = useState(null)

  useEffect(() => {
    fetchQR()
    fetchAttendance()
  }, [sessionId])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('attendance-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          setAttendance(prev => [...prev, payload.new])
          toast.success(`${payload.new.student_name} just checked in!`)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  // Countdown timer
  useEffect(() => {
    if (!qrData?.expires_at) return
    const interval = setInterval(() => {
      const now = new Date()
      const expires = new Date(qrData.expires_at)
      const diff = expires - now
      if (diff <= 0) {
        setIsExpired(true)
        setTimeLeft('Expired')
        clearInterval(interval)
      } else {
        const mins = Math.floor(diff / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [qrData])

  async function fetchQR() {
    try {
      const res = await fetch(`${API}/sessions/${sessionId}/qr`)
      const data = await res.json()
      setQrData(data)
    } catch (err) {
      toast.error('Failed to load QR code')
    }
  }

  async function fetchAttendance() {
    try {
      const res = await fetch(`${API}/attendance/session/${sessionId}`)
      const data = await res.json()
      setAttendance(data)
    } catch (err) {
      console.error(err)
    }
  }

  function exportCSV() {
    window.open(`${API}/attendance/export/${sessionId}`, '_blank')
    toast.success('CSV downloading...')
  }

  const progressPercent = totalStudents
    ? Math.round((attendance.length / totalStudents) * 100)
    : null

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-[#999] hover:text-[#111] transition"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isExpired ? 'bg-[#ef4444]' : 'bg-[#22c55e]'}`} />
          <span className={`text-xs font-medium ${isExpired ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
            {isExpired ? 'Expired' : 'Live'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT: QR Code */}
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 text-center">
          {/* QR Image */}
          {qrData?.qr_base64 ? (
            <div className="inline-block p-4 bg-[#fafafa] border border-[#e8e8e8] rounded-2xl mb-6">
              <img src={qrData.qr_base64} alt="QR Code" className="w-56 h-56" />
            </div>
          ) : (
            <div className="w-56 h-56 mx-auto mb-6 rounded-2xl bg-[#f0f0f0] animate-pulse" />
          )}

          {/* Timer */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Clock size={14} className="text-[#999]" />
            <span className={`font-mono text-xl font-medium ${isExpired ? 'text-[#ef4444]' : 'text-[#111]'}`}>
              {timeLeft || '--:--'}
            </span>
          </div>

          {/* Token + expiry pills */}
          <div className="flex gap-2 justify-center mb-6">
            <span className="px-3 py-1 rounded-lg bg-[#f0f0f0] text-xs text-[#666] font-mono">
              {qrData?.token}
            </span>
            <span className="px-3 py-1 rounded-lg bg-[#f0f0f0] text-xs text-[#666]">
              2 min expiry
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#111] text-white text-xs font-medium"
            >
              <RefreshCw size={12} /> New QR
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#e8e8e8] text-xs text-[#333]"
            >
              <Download size={12} /> Export CSV
            </button>
          </div>
        </div>

        {/* RIGHT: Live Attendance Feed */}
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6">
          {/* Header with count */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[#111]">Live feed</span>
            <span className="text-sm font-medium text-[#111]">
              {attendance.length}{totalStudents ? ` / ${totalStudents}` : ''}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-[#f0f0f0] rounded-full mb-1.5">
            <div
              className="h-1.5 bg-[#111] rounded-full transition-all duration-500"
              style={{ width: `${progressPercent || Math.min(attendance.length * 5, 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-[#999] mb-4">
            {progressPercent
              ? `${progressPercent}% checked in`
              : `${attendance.length} checked in`}
          </p>

          {/* Attendance list */}
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
            <AnimatePresence>
              {attendance.length === 0 ? (
                <div className="text-center py-14">
                  <p className="text-sm text-[#ccc]">Waiting for students to scan...</p>
                </div>
              ) : (
                attendance.map((record, i) => {
                  const isRecent = (Date.now() - new Date(record.marked_at).getTime()) < 10000
                  return (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-center justify-between p-3 rounded-xl ${
                        isRecent
                          ? 'bg-[#f0fdf4] border border-[#dcfce7]'
                          : 'bg-[#fafafa]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium ${
                          isRecent
                            ? 'bg-[#dcfce7] text-[#166534]'
                            : 'bg-[#e8e8e8] text-[#555]'
                        }`}>
                          {record.student_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-[#111]">{record.student_name}</p>
                          <p className="text-[11px] text-[#999]">{record.student_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isRecent ? (
                          <>
                            <span className="text-[11px] text-[#22c55e]">just now</span>
                            <Check size={12} className="text-[#22c55e]" />
                          </>
                        ) : (
                          <span className="text-[11px] text-[#999]">
                            {new Date(record.marked_at).toLocaleTimeString([], {
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )
                })
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}