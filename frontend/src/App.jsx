import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import SessionView from './pages/SessionView'
import MarkAttendance from './pages/MarkAttendance'
import NotesPage from './pages/NotesPage'
import HistoryPage from './pages/HistoryPage'

export default function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/session/:sessionId" element={<SessionView />} />
        <Route path="/notes/:classId" element={<NotesPage />} />
        <Route path="/history/:classId" element={<HistoryPage />} />
        <Route path="/mark/:token" element={<MarkAttendance />} />
      </Routes>
    </div>
  )
}