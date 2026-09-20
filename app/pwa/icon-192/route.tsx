import { ImageResponse } from "next/og";
import { brandBadge } from "@/lib/brand-icon";

export async function GET() {
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
        {brandBadge(150)}
      </div>
    ),
    { width: 192, height: 192 }
  );
}
