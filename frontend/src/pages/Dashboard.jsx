import { API } from '../lib/api'
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  QrCode,
  Users,
  Clock,
  ChevronRight,
  Zap,
  Download,
  FileText,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Dashboard() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newClass, setNewClass] = useState({ name: "", course_code: "" });
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({}); // per-class analytics
  const [alerts, setAlerts] = useState({}); // per-class alerts

  console.log("API:", API);
console.log("FULL URL:", `${API}/api/classes`);

  useEffect(() => {
    fetchClasses();
  }, []);

  // After classes load, fetch analytics + alerts for each
  useEffect(() => {
    classes.forEach((cls) => {
      fetchAnalytics(cls.id);
      fetchAlerts(cls.id);
    });
  }, [classes]);

  async function fetchClasses() {
    try {
      const res = await fetch(`${API}/api/classes`);
      const data = await res.json();
      setClasses(data);
    } catch (err) {
      toast.error("Failed to load classes");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAnalytics(classId) {
    try {
      const res = await fetch(`${API}/analytics/class/${classId}`);
      const data = await res.json();
      setAnalytics((prev) => ({ ...prev, [classId]: data }));
    } catch (err) {
      console.error("Analytics fetch failed", err);
    }
  }

  async function fetchAlerts(classId) {
    try {
      const res = await fetch(`${API}/alerts/class/${classId}?threshold=3`);
      const data = await res.json();
      setAlerts((prev) => ({ ...prev, [classId]: data }));
    } catch (err) {
      console.error("Alerts fetch failed", err);
    }
  }

  async function createClass(e) {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClass),
      });
      if (res.ok) {
        toast.success("Class created!");
        setNewClass({ name: "", course_code: "" });
        setShowCreate(false);
        fetchClasses();
      }
    } catch (err) {
      toast.error("Failed to create class");
    }
  }

  async function startSession(classId) {
    try {
      const res = await fetch(`${API}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: classId, expiry_minutes: 2 }),
      });
      const session = await res.json();
      navigate(`/session/${session.id}`);
    } catch (err) {
      toast.error("Failed to start session");
    }
  }

  function exportAll(classId) {
    window.open(`${API}/attendance/export-all/class/${classId}`, "_blank");
    toast.success("Exporting all attendance...");
  }

  // Combine all analytics for the summary stats
  const totalStudents = Object.values(analytics).reduce(
    (sum, a) => sum + (a?.total_unique_students || 0),
    0,
  );
  const totalSessions = Object.values(analytics).reduce(
    (sum, a) => sum + (a?.total_sessions || 0),
    0,
  );
  const overallAvg =
    Object.values(analytics).length > 0
      ? Math.round(
          Object.values(analytics).reduce(
            (sum, a) => sum + (a?.average_attendance || 0),
            0,
          ) / Object.values(analytics).length,
        )
      : 0;

  // Combine all alerts
  const allAlerts = [];
  Object.entries(alerts).forEach(([classId, data]) => {
    if (data?.alerts?.length > 0) {
      const cls = classes.find((c) => c.id === classId);
      allAlerts.push({
        className: cls?.name || "Unknown",
        courseCode: cls?.course_code || "",
        count: data.alerts.length,
        classId,
      });
    }
  });

  // Combine trend data for chart (last 8 data points)
  const allTrend = Object.values(analytics)
    .flatMap((a) => a?.trend || [])
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#111] flex items-center justify-center">
            <QrCode size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-medium tracking-tight text-[#111]">
              Attendance Tracker
            </h1>
            <p className="text-xs text-[#999]">Physics dept — Spring 2026</p>
          </div>
        </div>
        <div className="w-9 h-9 rounded-full bg-[#111] flex items-center justify-center text-sm font-medium text-white">
          N
        </div>
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Total students",
            value: totalStudents,
            sub: `Across ${classes.length} classes`,
          },
          {
            label: "Avg attendance",
            value: overallAvg || "—",
            sub: null,
            showBar: true,
          },
          { label: "Sessions", value: totalSessions, sub: "All time" },
          {
            label: "Time saved",
            value: `${Math.round((totalSessions * 10) / 60)}h`,
            sub: "~10 min/class",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-[#e8e8e8] rounded-2xl p-4"
          >
            <p className="text-[11px] text-[#999] mb-1">{stat.label}</p>
            <p className="text-2xl font-medium text-[#111] tracking-tight">
              {stat.value}
            </p>
            {stat.showBar ? (
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`flex-1 h-[3px] rounded-full ${
                      i <= Math.round((overallAvg || 0) / 20)
                        ? "bg-[#111]"
                        : "bg-[#e8e8e8]"
                    }`}
                  />
                ))}
              </div>
            ) : stat.sub ? (
              <p className="text-[11px] text-[#999] mt-1">{stat.sub}</p>
            ) : null}
          </div>
        ))}
      </div>

      {/* ===== ATTENDANCE CHART ===== */}
      {allTrend.length > 0 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-[#111]">Attendance trend</p>
            <p className="text-xs text-[#999]">{allTrend.length} sessions</p>
          </div>
          <div className="flex items-end justify-center gap-3 h-20">
            {allTrend.map((point, i) => {
              const maxCount = Math.max(...allTrend.map((t) => t.count), 1);
              const heightPercent = Math.max((point.count / maxCount) * 100, 8);
              const isLast = i === allTrend.length - 1;
              return (
                <div
                  key={i}
                  className="flex items-end"
                  style={{ height: "100%" }}
                >
                  <div
                    className="rounded-t"
                    style={{
                      width: "24px",
                      height: `${heightPercent}%`,
                      backgroundColor: isLast ? "#111" : "#ccc",
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-[#ccc]">{allTrend[0]?.date}</span>
            <span className="text-[10px] text-[#111]">Latest</span>
          </div>
        </div>
      )}

      {/* ===== LOW ATTENDANCE ALERTS ===== */}
      {allAlerts.length > 0 && (
        <div className="bg-[#fffbeb] border border-[#fde68a] rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-[#d97706]" />
            <p className="text-sm font-medium text-[#92400e]">
              Low attendance alerts
            </p>
          </div>
          <div className="space-y-2">
            {allAlerts.map((alert, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                  <span className="text-xs text-[#78350f]">
                    {alert.count} student{alert.count > 1 ? "s" : ""} missed 3+
                    sessions in {alert.className}
                  </span>
                </div>
                <span className="text-xs text-[#d97706]">View list ›</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== CLASS LIST HEADER ===== */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-[#111]">Your classes</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              classes.forEach((cls) => exportAll(cls.id));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e8e8e8] text-xs text-[#666] hover:border-[#ccc] transition"
          >
            <Download size={12} /> Export all
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111] text-white text-xs font-medium"
          >
            <Plus size={12} /> Add class
          </button>
        </div>
      </div>

      {/* ===== CREATE CLASS FORM ===== */}
      <AnimatePresence>
        {showCreate && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={createClass}
            className="mb-4 p-5 rounded-2xl border border-[#e8e8e8] bg-white overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[11px] text-[#999] block mb-1">
                  Class name
                </label>
                <input
                  type="text"
                  placeholder="Physics 101 Lab"
                  value={newClass.name}
                  onChange={(e) =>
                    setNewClass({ ...newClass, name: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[#e8e8e8] text-sm text-[#111] placeholder:text-[#ccc]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#999] block mb-1">
                  Course code
                </label>
                <input
                  type="text"
                  placeholder="PHYS-1021"
                  value={newClass.course_code}
                  onChange={(e) =>
                    setNewClass({ ...newClass, course_code: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[#e8e8e8] text-sm text-[#111] placeholder:text-[#ccc]"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#111] text-white text-xs font-medium"
            >
              Create class
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* ===== CLASS CARDS ===== */}
      {loading ? (
        <div className="text-center py-16 text-[#999] text-sm">Loading...</div>
      ) : classes.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[#e8e8e8]">
          <QrCode size={32} className="mx-auto mb-3 text-[#ccc]" />
          <p className="text-sm text-[#999]">
            No classes yet. Add your first class.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {classes.map((cls) => {
            const a = analytics[cls.id];
            const avgPct = a
              ? Math.round(
                  (a.average_attendance / (a.total_unique_students || 1)) * 100,
                )
              : null;
            return (
              <div
                key={cls.id}
                className="card-hover p-4 rounded-2xl border border-[#e8e8e8] bg-white"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#f0f0f0] flex items-center justify-center text-sm font-medium text-[#333]">
                      {cls.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#111]">
                          {cls.name}
                        </span>
                        {avgPct !== null && (
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full ${
                              avgPct >= 85
                                ? "bg-[#dcfce7] text-[#166534]"
                                : avgPct >= 70
                                  ? "bg-[#fef3c7] text-[#92400e]"
                                  : "bg-[#fef2f2] text-[#dc2626]"
                            }`}
                          >
                            {avgPct}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#999] mt-0.5">
                        {cls.course_code}
                        {a
                          ? ` — ${a.total_unique_students} students — ${a.total_sessions} sessions`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/history/${cls.id}`);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#e8e8e8] text-[11px] text-[#666] hover:border-[#ccc] transition"
                    >
                      History
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/notes/${cls.id}`);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#e8e8e8] text-[11px] text-[#666] hover:border-[#ccc] transition"
                    >
                      Notes
                    </button>
                    <button
                      onClick={() => startSession(cls.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#111] text-white text-[11px] font-medium"
                    >
                      Start ›
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
