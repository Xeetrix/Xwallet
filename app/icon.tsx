import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111420",
          borderRadius: 8,
          border: "1.5px solid #C79A3F",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 18,
            fontWeight: 700,
            color: "#E5C06E",
            fontFamily: "sans-serif",
          }}
        >
          X
        </div>
      </div>
    ),
    { ...size }
  );
}
