import { ImageResponse } from "next/og";

// Branded social-share image (generated on demand; no static asset to ship).
// Runs on the default Node runtime — keeping the app free of Edge functions.
export const alt = "DormDrop — 24/7 student delivery at Southampton";
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
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 60,
            }}
          >
            💧
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#fbbf24" }}>
            DormDrop
          </div>
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.1,
            maxWidth: 900,
          }}
        >
          Anything delivered to your door. Any hour.
        </div>
        <div style={{ marginTop: 28, fontSize: 30, color: "#a7f3d0" }}>
          24/7 student delivery at the University of Southampton
        </div>
      </div>
    ),
    { ...size },
  );
}
