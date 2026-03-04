import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

// States: 0 = absent, 1 = present, 2 = excused
export default function AttendancePage({ roster }) {
  const [players, setPlayers] = useState([]);
  const [practices, setPractices] = useState([]);
  const [att, setAtt] = useState({});          // att[playerId][date] = 0|1|2
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPractice, setNewPractice] = useState("");

  useEffect(() => {
    if (roster?.id) {
      fetchPlayers();
    } else {
      setPlayers([]);
      setAtt({});
    }
  }, [roster?.id]);

  async function fetchPlayers() {
    setLoading(true);
    const { data } = await supabase
      .from("players")
      .select("id, name, gender")
      .eq("roster_id", roster.id)
      .order("name");
    const loaded = data || [];
    setPlayers(loaded);
    // Init attendance: keep existing entries, add missing player/date combos as absent
    setAtt(prev => {
      const next = {};
      loaded.forEach(p => {
        next[p.id] = { ...(prev[p.id] || {}) };
        practices.forEach(d => {
          if (next[p.id][d] === undefined) next[p.id][d] = 0;
        });
      });
      return next;
    });
    setLoading(false);
  }

  function cycleState(playerId, date) {
    setAtt(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], [date]: ((prev[playerId]?.[date] ?? 0) + 1) % 3 }
    }));
  }

  function handleAddPractice() {
    const label = newPractice.trim();
    if (!label || practices.includes(label)) return;
    setPractices(prev => [...prev, label]);
    setAtt(prev => {
      const next = { ...prev };
      players.forEach(p => {
        next[p.id] = { ...(next[p.id] || {}), [label]: 0 };
      });
      return next;
    });
    setNewPractice("");
    setShowAddForm(false);
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
                        <div>{d}</div>
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
                                    width: 26, height: 26, borderRadius: 4, margin: "0 auto",
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
