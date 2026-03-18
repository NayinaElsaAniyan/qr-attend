import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function NotesPage() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    week_number: '',
    content: '',
    tags: ''
  })

  useEffect(() => {
    fetchNotes()
  }, [classId])

  async function fetchNotes() {
    try {
      const res = await fetch(`/api/notes/class/${classId}`)
      const data = await res.json()
      setNotes(data)
    } catch (err) {
      toast.error('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  async function createNote(e) {
    e.preventDefault()
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: classId,
          week_number: parseInt(form.week_number),
          content: form.content,
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean)
        })
      })
      if (res.ok) {
        toast.success('Note added!')
        setForm({ week_number: '', content: '', tags: '' })
        setShowCreate(false)
        fetchNotes()
      }
    } catch (err) {
      toast.error('Failed to create note')
    }
  }

  async function updateNote(noteId) {
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: form.content,
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean)
        })
      })
      if (res.ok) {
        toast.success('Note updated!')
        setEditingId(null)
        setForm({ week_number: '', content: '', tags: '' })
        fetchNotes()
      }
    } catch (err) {
      toast.error('Failed to update note')
    }
  }

  async function deleteNote(noteId) {
    if (!confirm('Delete this note?')) return
    try {
      await fetch(`/api/notes/${noteId}`, { method: 'DELETE' })
      toast.success('Note deleted')
      fetchNotes()
    } catch (err) {
      toast.error('Failed to delete note')
    }
  }

  function startEdit(note) {
    setEditingId(note.id)
    setForm({
      week_number: note.week_number,
      content: note.content,
      tags: (note.tags || []).join(', ')
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ week_number: '', content: '', tags: '' })
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-[#999] hover:text-[#111] transition"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <button
          onClick={() => {
            setShowCreate(!showCreate)
            setEditingId(null)
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111] text-white text-xs font-medium"
        >
          <Plus size={12} /> Add week
        </button>
      </div>

      <h1 className="text-xl font-medium text-[#111] mb-1">Weekly Notes</h1>
      <p className="text-sm text-[#999] mb-6">Your teaching journal for this class</p>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={createNote}
            className="mb-6 p-5 rounded-2xl border border-[#e8e8e8] bg-white overflow-hidden"
          >
            <div className="flex gap-3 mb-3">
              <div className="w-24">
                <label className="text-[11px] text-[#999] block mb-1">Week #</label>
                <input
                  type="number"
                  min="1"
                  placeholder="8"
                  value={form.week_number}
                  onChange={e => setForm({ ...form, week_number: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[#e8e8e8] text-sm text-[#111] placeholder:text-[#ccc]"
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] text-[#999] block mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="Wave optics, Ch. 14, Quiz next week"
                  value={form.tags}
                  onChange={e => setForm({ ...form, tags: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#e8e8e8] text-sm text-[#111] placeholder:text-[#ccc]"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="text-[11px] text-[#999] block mb-1">Notes</label>
              <textarea
                placeholder="What did you cover? What did students struggle with? Any reminders for next week?"
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                required
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-[#e8e8e8] text-sm text-[#111] placeholder:text-[#ccc] resize-none"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#111] text-white text-xs font-medium"
            >
              Save note
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Notes list */}
      {loading ? (
        <div className="text-center py-16 text-sm text-[#999]">Loading...</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[#e8e8e8]">
          <p className="text-sm text-[#999]">No notes yet. Add your first weekly note.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note, i) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border border-[#e8e8e8] rounded-2xl p-5"
            >
              {editingId === note.id ? (
                /* Edit mode */
                <div>
                  <div className="mb-3">
                    <textarea
                      value={form.content}
                      onChange={e => setForm({ ...form, content: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 rounded-lg border border-[#e8e8e8] text-sm text-[#111] resize-none"
                    />
                  </div>
                  <div className="mb-3">
                    <input
                      type="text"
                      value={form.tags}
                      onChange={e => setForm({ ...form, tags: e.target.value })}
                      placeholder="Tags (comma separated)"
                      className="w-full px-3 py-2 rounded-lg border border-[#e8e8e8] text-sm text-[#111]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateNote(note.id)}
                      className="px-4 py-1.5 rounded-lg bg-[#111] text-white text-xs font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-1.5 rounded-lg border border-[#e8e8e8] text-xs text-[#666]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                        i === 0
                          ? 'bg-[#111] text-white'
                          : 'bg-[#f0f0f0] text-[#666]'
                      }`}>
                        Week {note.week_number}
                      </span>
                      <span className="text-xs text-[#999]">{note.date}</span>
                      {i === 0 && (
                        <span className="text-[11px] bg-[#dcfce7] text-[#166534] px-2 py-0.5 rounded">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(note)}
                        className="p-1.5 rounded-lg hover:bg-[#f0f0f0] transition"
                      >
                        <Pencil size={12} className="text-[#999]" />
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="p-1.5 rounded-lg hover:bg-[#fef2f2] transition"
                      >
                        <Trash2 size={12} className="text-[#999]" />
                      </button>
                    </div>
                  </div>

                  <p className="text-[13px] text-[#333] leading-relaxed mb-3">
                    {note.content}
                  </p>

                  {note.tags && note.tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {note.tags.map((tag, j) => (
                        <span
                          key={j}
                          className={`text-[11px] px-2 py-0.5 rounded ${
                            tag.toLowerCase().includes('quiz') || tag.toLowerCase().includes('exam')
                              ? 'bg-[#fef2f2] text-[#dc2626]'
                              : tag.toLowerCase().includes('revisit') || tag.toLowerCase().includes('review')
                              ? 'bg-[#fef3c7] text-[#92400e]'
                              : 'bg-[#f0f0f0] text-[#666]'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}