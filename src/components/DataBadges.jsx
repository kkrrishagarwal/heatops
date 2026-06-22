// SECTION 2 - DATA SOURCE LABELS COMPONENTS

// Source badge for charts and cards
export function SourceBadge({ source }) {
  return (
    <div style={{
      fontSize: 9,
      color: "rgba(255,255,255,0.35)",
      marginTop: 4,
      fontStyle: "italic",
      display: "flex",
      alignItems: "center",
      gap: 4
    }}>
      <span style={{
        color: "#00ff88",
        fontSize: 8
      }}>📡</span>
      Source: {source}
    </div>
  )
}

