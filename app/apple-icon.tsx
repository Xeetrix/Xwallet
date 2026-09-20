import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#090A10",
        }}
      >
        <div
          style={{
            width: "76%",
            height: "76%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#111420",
            borderRadius: 36,
            border: "6px solid #C79A3F",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 700,
              color: "#E5C06E",
              fontFamily: "sans-serif",
            }}
          >
            X
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
