// Shared JSX for the gold "X" badge, rendered at whatever pixel size the
// caller needs via next/og's ImageResponse (favicon, apple touch icon, PWA
// manifest icons, and the social-share preview image all draw the same
// mark rather than each hand-tuning their own proportions).
export function brandBadge(px: number) {
  const border = Math.max(1, Math.round(px * 0.045));
  const radius = Math.round(px * 0.26);
  const fontSize = Math.round(px * 0.52);
  return (
    <div
      style={{
        width: px,
        height: px,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#111420",
        borderRadius: radius,
        border: `${border}px solid #C79A3F`,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize,
          fontWeight: 700,
          color: "#E5C06E",
          fontFamily: "sans-serif",
        }}
      >
        X
      </div>
    </div>
  );
}
