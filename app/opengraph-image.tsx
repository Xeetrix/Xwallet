import { ImageResponse } from "next/og";
import { brandBadge } from "@/lib/brand-icon";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#090A10",
        }}
      >
        {brandBadge(160)}
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 64,
            fontWeight: 700,
            color: "#F5F5F5",
            fontFamily: "sans-serif",
          }}
        >
          XWallet Asia
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 16,
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#D4AF37",
            fontFamily: "sans-serif",
          }}
        >
          Private Wealth &amp; Digital Asset Custody
        </div>
      </div>
    ),
    { ...size }
  );
}
