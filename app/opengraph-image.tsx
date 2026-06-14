import { ImageResponse } from "next/og";

export const alt = "RoofSIP. Storm hits. RoofSIP texts. You get the job.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "#09090b",
          color: "#e4e4e7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "60px",
              height: "60px",
              borderRadius: "16px",
              background: "#0ea5e9",
              color: "#ffffff",
              fontSize: "36px",
              fontWeight: 800,
            }}
          >
            R
          </div>
          <div style={{ display: "flex", fontSize: "32px", fontWeight: 700 }}>
            RoofSIP
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: "84px",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-2px",
          }}
        >
          <div style={{ display: "flex" }}>Storm hits.</div>
          <div style={{ display: "flex", color: "#38bdf8" }}>RoofSIP texts.</div>
          <div style={{ display: "flex" }}>You get the job.</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <div style={{ display: "flex", fontSize: "27px", color: "#a1a1aa" }}>
            Watches your not-ready roofs. Books the inspection when a storm hits.
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{ display: "flex", fontSize: "27px", color: "#38bdf8", fontWeight: 600 }}
            >
              roofsip.vercel.app
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "23px",
                color: "#a1a1aa",
                border: "1px solid #27272a",
                borderRadius: "999px",
                padding: "10px 20px",
              }}
            >
              Free for 60 days
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
