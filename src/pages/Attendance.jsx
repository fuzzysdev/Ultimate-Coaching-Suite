import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { offlineStore } from "../lib/offlineStore";

// States: 0 = absent, 1 = present, 2 = excused
export default function AttendancePage({ org, roster }) {
  const [players, setPlayers] = useState([]);
  const [practices, setPractices] = useState([]);
  const [att, setAtt] = useState({});          // att[playerId][label] = 0|1|2
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPractice, setNewPractice] = useState("");
  const saveTimer = useRef(null);
  // Always-current refs so closures (cleanup, timer) never go stale
  const attRef = useRef({});
  const practicesRef = useRef([]);
  const rosterRef = useRef(roster);
  const orgRef = useRef(org);
  useEffect(() => { rosterRef.current = roster; }, [roster]);
  useEffect(() => { orgRef.current = org; }, [org]);

  // Flush any pending save on unmount (or roster change) so data is never lost
  useEffect(() => {
    return () => {
      if (!saveTimer.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const r = rosterRef.current;
      const o = orgRef.current;
      const p = practicesRef.current;
      const a = attRef.current;
      if (!r?.id || !o?.id) return;
      const payload = { roster_id: r.id, organization_id: o.id, practices: p, records: a, updated_at: new Date().toISOString() };
      offlineStore.setCache(`attendance_${r.id}`, { practices: p, records: a, savedAt: Date.now() });
      if (navigator.onLine) {
        supabase.from("attendance_data").upsert(payload, { onConflict: "roster_id" });
      } else {
        offlineStore.enqueue(`attendance_${r.id}`, { table: "attendance_data", method: "upsert", conflict: "roster_id", data: payload });
      }
    };
  }, []);

  useEffect(() => {
    if (!roster?.id) { setPlayers([]); setAtt({}); setPractices([]); attRef.current = {}; practicesRef.current = []; return; }

    // Clear previous roster's data immediately so stale dates never show
    setPractices([]);
    setAtt({});
    attRef.current = {};
    practicesRef.current = [];

    // Migrate old localStorage format (pre-DB) if present
    const oldKey = `ucs_attendance_${roster.id}`;
    const oldRaw = localStorage.getItem(oldKey);
    if (oldRaw) {
      try {
        const { practices: p, att: a } = JSON.parse(oldRaw);
        localStorage.removeItem(oldKey);
        if (p?.length) {
          setPractices(p || []);
          setAtt(a || {});
          practicesRef.current = p || [];
          attRef.current = a || {};
          saveToDb(p || [], a || {});
          offlineStore.setCache(`attendance_${roster.id}`, { practices: p || [], records: a || {}, savedAt: Date.now() });
        }
      } catch { localStorage.removeItem(oldKey); }
    } else {
      // Show cached data immediately while DB loads
      const cached = offlineStore.getCache(`attendance_${roster.id}`);
      if (cached) {
        setPractices(cached.practices || []);
        setAtt(cached.records || {});
        practicesRef.current = cached.practices || [];
        attRef.current = cached.records || {};
      }
    }

    fetchData();
    fetchPlayers();
  }, [roster?.id]);

  async function fetchData() {
    try {
      if (!navigator.onLine) return; // cache already applied in useEffect
      // Skip DB fetch if we have a fresh local write (< 30s) — avoids overwriting unsaved changes
      const cached = offlineStore.getCache(`attendance_${roster.id}`);
      if (cached?.savedAt && Date.now() - cached.savedAt < 30000) return;
      const { data, error } = await supabase
        .from("attendance_data")
        .select("practices, records")
        .eq("roster_id", roster.id)
        .single();
      if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
      if (!data) return; // No row yet — starts empty
      const p = data.practices || [];
      const r = data.records || {};
      setPractices(p);
      setAtt(r);
      practicesRef.current = p;
      attRef.current = r;
      offlineStore.setCache(`attendance_${roster.id}`, { practices: p, records: r, savedAt: Date.now() });
    } catch { /* cache already applied */ }
  }

  async function fetchPlayers() {
    const cacheKey = `roster_players_${roster.id}`;
    setLoading(true);
    try {
      let loaded;
      if (!navigator.onLine) {
        loaded = offlineStore.getCache(cacheKey) || [];
      } else {
        const { data } = await supabase
          .from("players")
          .select("id, name, gender")
          .eq("roster_id", roster.id)
          .order("name");
        loaded = data || [];
        offlineStore.setCache(cacheKey, loaded);
      }
      setPlayers(loaded);
    } catch {
      const cached = offlineStore.getCache(cacheKey);
      if (cached) setPlayers(cached);
    } finally {
      setLoading(false);
    }
  }

  function scheduleSave(newPractices, newAtt) {
    // Write to cache immediately so remounting within 800ms still shows correct data
    if (roster?.id) {
      offlineStore.setCache(`attendance_${roster.id}`, { practices: newPractices, records: newAtt, savedAt: Date.now() });
    }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveToDb(newPractices, newAtt); saveTimer.current = null; }, 800);
  }

  async function saveToDb(currentPractices, currentAtt) {
    if (!roster?.id || !org?.id) return;
    const cacheKey = `attendance_${roster.id}`;
    const queueKey = `attendance_${roster.id}`;
    const payload = {
      roster_id: roster.id,
      organization_id: org.id,
      practices: currentPractices,
      records: currentAtt,
      updated_at: new Date().toISOString(),
    };
    offlineStore.setCache(cacheKey, { practices: currentPractices, records: currentAtt });
    if (!navigator.onLine) {
      offlineStore.enqueue(queueKey, {
        table: "attendance_data",
        method: "upsert",
        conflict: "roster_id",
        data: payload,
      });
      return;
    }
    const { error } = await supabase
      .from("attendance_data")
      .upsert(payload, { onConflict: "roster_id" });
    if (!error) offlineStore.dequeue(queueKey);
  }

  function cycleState(playerId, date) {
    const prev = attRef.current;
    const newAtt = {
      ...prev,
      [playerId]: { ...prev[playerId], [date]: ((prev[playerId]?.[date] ?? 0) + 1) % 3 },
    };
    attRef.current = newAtt;
    setAtt(newAtt);
    scheduleSave(practicesRef.current, newAtt);
  }

  function handleAddPractice() {
    const label = newPractice.trim();
    if (!label || practicesRef.current.includes(label)) return;
    const newPractices = [...practicesRef.current, label];
    const newAtt = { ...attRef.current };
    players.forEach(p => {
      newAtt[p.id] = { ...(newAtt[p.id] || {}), [label]: 0 };
    });
    practicesRef.current = newPractices;
    attRef.current = newAtt;
    setPractices(newPractices);
    setAtt(newAtt);
    setNewPractice("");
    setShowAddForm(false);
    scheduleSave(newPractices, newAtt);
  }

  function removePractice(label) {
    const newPractices = practicesRef.current.filter(p => p !== label);
    const newAtt = {};
    Object.keys(attRef.current).forEach(playerId => {
      const playerAtt = { ...attRef.current[playerId] };
      delete playerAtt[label];
      newAtt[playerId] = playerAtt;
    });
    practicesRef.current = newPractices;
    attRef.current = newAtt;
    setPractices(newPractices);
    setAtt(newAtt);
    if (highlighted === label) setHighlighted(null);
    scheduleSave(newPractices, newAtt);
  }

  function getCellStyle(state) {
    if (state === 1) return { bg: "#0a3d2b", border: "#00e5a0", color: "#00e5a0", label: "✓" };
    if (state === 2) return { bg: "#2a2410", border: "#7a4a0a", color: "#fbbf24", label: "" };
    return { bg: "#1a1f2e", border: "#2a2f42", color: "#2a2f42", label: "" };
  }

  function calcPct(playerId) {
    const playerAtt = att[playerId] || {};
    const countable = practices.filter(d => playerAtt[d] !== 2);
    if (countable.length === 0) return null;
    const present = countable.filter(d => playerAtt[d] === 1).length;
    return Math.round((present / countable.length) * 100);
  }

  function sessionSummary(date) {
    const present = players.filter(p => att[p.id]?.[date] === 1).length;
    const excused = players.filter(p => att[p.id]?.[date] === 2).length;
    return { present, excused, absent: players.length - present - excused };
  }

  const font = "'Barlow Condensed', sans-serif";
  const genderGroups = [
    { key: "Female", label: "♀  Women" },
    { key: "Male",   label: "♂  Men"  },
  ];

  if (!roster) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#7a8099", fontFamily: font, fontSize: 16, letterSpacing: 2, textTransform: "uppercase" }}>
        Select a roster to view attendance
      </div>
    );
  }

  return (
    <div style={{ fontFamily: font, background: "#0f1117", color: "#e8eaf0", flex: 1, overflowY: "auto", padding: 16 }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>

        {/* Header */}
        <div style={{
          background: "#181c26", borderRadius: "10px 10px 0 0",
          padding: "14px 20px", borderBottom: "2px solid #2a2f42",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12
        }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 4, color: "#00e5a0", marginBottom: 2, textTransform: "uppercase" }}>Attendance Tracker</div>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase" }}>
              {roster.name}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right", fontSize: 11, color: "#7a8099", lineHeight: 1.7 }}>
              <div>{players.length} players</div>
              <div>{practices.length} sessions</div>
            </div>
            {showAddForm ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  autoFocus
                  value={newPractice}
                  onChange={e => setNewPractice(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleAddPractice();
                    if (e.key === "Escape") { setShowAddForm(false); setNewPractice(""); }
                  }}
                  placeholder="e.g. Oct 15"
                  maxLength={50}
                  style={{
                    background: "#1a1f2e", border: "1px solid #2a2f42", color: "#e8eaf0",
                    fontFamily: font, fontSize: 13, padding: "5px 10px",
                    borderRadius: 6, outline: "none", width: 100
                  }}
                />
                <button onClick={handleAddPractice} style={btnStyle("#00e5a0", "#0f1117")}>Add</button>
                <button onClick={() => { setShowAddForm(false); setNewPractice(""); }} style={btnStyle("#2a2f42", "#7a8099")}>✕</button>
              </div>
            ) : (
              <button onClick={() => setShowAddForm(true)} style={btnStyle("#00e5a0", "#0f1117")}>
                + Add Practice
              </button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div style={{
          background: "#12161f", padding: "7px 20px",
          display: "flex", gap: 20, fontSize: 11, alignItems: "center",
          borderBottom: "1px solid #2a2f42", flexWrap: "wrap"
        }}>
          <span style={{ color: "#7a8099", marginRight: 4, letterSpacing: 1, textTransform: "uppercase" }}>Tap to cycle:</span>
          <LegendItem bg="#1a1f2e" border="#2a2f42" label="Absent"  labelColor="#7a8099" />
          <LegendItem bg="#0a3d2b" border="#00e5a0" label="Present" labelColor="#00e5a0" />
          <LegendItem bg="#2a2410" border="#7a4a0a" label="Excused" labelColor="#fbbf24" />
          <span style={{ color: "#7a8099", marginLeft: "auto", fontSize: 10 }}>% excludes excused absences</span>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto", background: "#0f1117", borderRadius: "0 0 10px 10px", border: "1px solid #2a2f42", borderTop: "none" }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "#7a8099", letterSpacing: 2, textTransform: "uppercase", fontSize: 12 }}>
              Loading players...
            </div>
          ) : practices.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#7a8099", fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📅</div>
              <div>No practices yet — click <strong style={{ color: "#00e5a0" }}>+ Add Practice</strong> to get started.</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#181c26" }}>
                  <th style={{
                    padding: "10px 16px", textAlign: "left", color: "#00e5a0",
                    fontSize: 10, letterSpacing: 2, borderBottom: "1px solid #2a2f42",
                    textTransform: "uppercase", minWidth: 120, position: "sticky", left: 0,
                    background: "#181c26", zIndex: 1
                  }}>Player</th>
                  {practices.map(d => {
                    const s = sessionSummary(d);
                    return (
                      <th key={d}
                        onClick={() => setHighlighted(highlighted === d ? null : d)}
                        style={{
                          padding: "6px 8px", textAlign: "center",
                          color: highlighted === d ? "#00e5a0" : "#7a8099",
                          fontSize: 10, letterSpacing: 1, borderBottom: "1px solid #2a2f42",
                          cursor: "pointer", whiteSpace: "nowrap", minWidth: 58,
                          textTransform: "uppercase",
                          background: highlighted === d ? "rgba(0,229,160,0.06)" : "transparent",
                          transition: "all 0.15s"
                        }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                          <span>{d}</span>
                          {highlighted === d && (
                            <button
                              onClick={(e) => { e.stopPropagation(); removePractice(d); }}
                              title="Remove this session"
                              style={{
                                background: "none", border: "none", color: "#ff4d6d",
                                cursor: "pointer", fontSize: 13, fontWeight: 900,
                                padding: "0 1px", lineHeight: 1, flexShrink: 0
                              }}
                            >×</button>
                          )}
                        </div>
                        <div style={{ fontSize: 9, color: "#7a8099", fontWeight: 400, marginTop: 2, lineHeight: 1.4 }}>
                          <span style={{ color: "#00e5a0" }}>{s.present}</span>
                          {s.excused > 0 && <span style={{ color: "#fbbf24" }}> +{s.excused}E</span>}
                        </div>
                      </th>
                    );
                  })}
                  <th style={{
                    padding: "10px 10px", textAlign: "center", color: "#00e5a0",
                    fontSize: 10, letterSpacing: 1, borderBottom: "1px solid #2a2f42",
                    textTransform: "uppercase", minWidth: 52
                  }}>Att%</th>
                </tr>
              </thead>
              <tbody>
                {genderGroups.map(({ key, label }) => {
                  const group = players.filter(p => p.gender === key);
                  if (group.length === 0) return null;
                  return (
                    <>
                      <tr key={key}>
                        <td colSpan={practices.length + 2} style={{
                          padding: "5px 16px", fontSize: 9, letterSpacing: 4,
                          color: "#00e5a0", background: "#0c0f17",
                          borderTop: "1px solid #2a2f42", borderBottom: "1px solid #2a2f42",
                          textTransform: "uppercase"
                        }}>
                          {label}
                        </td>
                      </tr>
                      {group.map((p, i) => {
                        const pct = calcPct(p.id);
                        const pctColor = pct === null ? "#7a8099" : pct >= 80 ? "#00e5a0" : pct >= 50 ? "#fbbf24" : "#e05a5a";
                        const excusedCount = practices.filter(d => att[p.id]?.[d] === 2).length;
                        return (
                          <tr key={p.id} style={{ background: i % 2 === 0 ? "#131825" : "#0f1117" }}>
                            <td style={{
                              padding: "7px 16px", fontWeight: 700, fontSize: 13,
                              borderRight: "1px solid #2a2f42",
                              position: "sticky", left: 0,
                              background: i % 2 === 0 ? "#131825" : "#0f1117", zIndex: 1
                            }}>
                              {p.name}
                              {excusedCount > 0 && (
                                <span style={{ fontSize: 9, color: "#fbbf24", marginLeft: 5, fontWeight: 400 }}>
                                  {excusedCount}E
                                </span>
                              )}
                            </td>
                            {practices.map(d => {
                              const state = att[p.id]?.[d] ?? 0;
                              const { bg, border, color, label: cellLabel } = getCellStyle(state);
                              return (
                                <td key={d} style={{
                                  textAlign: "center", padding: "5px 6px", cursor: "pointer",
                                  background: highlighted === d ? "rgba(0,229,160,0.04)" : "transparent"
                                }}
                                  onClick={() => cycleState(p.id, d)}>
                                  <div style={{
                                    width: 36, height: 36, borderRadius: 5, margin: "0 auto",
                                    background: bg, border: `1px solid ${border}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 12, fontWeight: 900, color,
                                    transition: "all 0.15s",
                                    boxShadow: state === 1 ? "0 0 6px rgba(0,229,160,0.25)" : "none"
                                  }}>
                                    {cellLabel}
                                  </div>
                                </td>
                              );
                            })}
                            <td style={{ textAlign: "center", padding: "7px 10px" }}>
                              <span style={{ fontWeight: 900, fontSize: 13, color: pctColor }}>
                                {pct === null ? "—" : `${pct}%`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Session totals footer */}
          {practices.length > 0 && (
            <div style={{
              borderTop: "2px solid #2a2f42", background: "#181c26",
              display: "flex", padding: "8px 0", overflowX: "auto"
            }}>
              <div style={{
                minWidth: 120, padding: "4px 16px", fontSize: 10,
                color: "#7a8099", letterSpacing: 2, flexShrink: 0,
                textTransform: "uppercase", position: "sticky", left: 0, background: "#181c26"
              }}>Totals</div>
              {practices.map(d => {
                const s = sessionSummary(d);
                return (
                  <div key={d} style={{ minWidth: 58, textAlign: "center", padding: "2px 6px", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#00e5a0" }}>{s.present}</div>
                    {s.excused > 0 && <div style={{ fontSize: 9, color: "#fbbf24" }}>{s.excused}E</div>}
                    <div style={{ fontSize: 9, color: "#e05a5a" }}>{s.absent} abs</div>
                  </div>
                );
              })}
              <div style={{ minWidth: 52 }} />
            </div>
          )}
        </div>

        {/* Footer key */}
        {practices.length > 0 && (
          <div style={{ padding: "10px 4px", fontSize: 11, color: "#7a8099", display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span style={{ color: "#00e5a0" }}>● ≥80% good standing</span>
            <span style={{ color: "#fbbf24" }}>● ≥50% monitor</span>
            <span style={{ color: "#e05a5a" }}>● &lt;50% at risk</span>
            <span style={{ color: "#fbbf24", marginLeft: "auto" }}>E = excused (not counted in %)</span>
          </div>
        )}
      </div>
    </div>
  );
}

function LegendItem({ bg, border, label, labelColor }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 13, height: 13, background: bg, border: `1px solid ${border}`, borderRadius: 2, display: "inline-block" }} />
      <span style={{ color: labelColor }}>{label}</span>
    </span>
  );
}

function btnStyle(bg, color) {
  return {
    background: bg, color, border: "none", fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 12, fontWeight: 800, padding: "6px 14px", borderRadius: 6,
    cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap"
  };
}
