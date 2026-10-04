import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Social preview cards (1200x630), rendered with Satori: flexbox only, every
// multi-child element needs display:flex.

export const OG_SIZE = { width: 1200, height: 630 };

// Geist (SIL Open Font License), bundled so headlines render in the site's own heavy type.
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700 | 900; style: "normal" }[]> | undefined;
function loadFonts() {
  fonts ??= Promise.all(
    ([400, 700, 900] as const).map(async (weight) => ({
      name: "Geist",
      data: await readFile(join(process.cwd(), "assets", `Geist-${weight}.ttf`)),
      weight,
      style: "normal" as const,
    })),
  );
  return fonts;
}

const AMBER = "#fcd34d";
const BG = "#070a16";

function Door({ open }: { open: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* status lamp */}
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          marginBottom: 18,
          background: open ? "#34d399" : "#fb7185",
          boxShadow: `0 0 40px 10px ${open ? "rgba(52,211,153,0.6)" : "rgba(251,113,133,0.5)"}`,
        }}
      />
      <div
        style={{
          display: "flex",
          width: 250,
          height: 360,
          borderRadius: "125px 125px 0 0",
          border: "12px solid #3b2f2a",
          borderBottom: "none",
          background: open ? "linear-gradient(180deg, #fffbea 0%, #fde68a 100%)" : "#2a3150",
          boxShadow: open ? "0 0 120px 40px rgba(253,230,138,0.35)" : "none",
          position: "relative",
        }}
      >
        {open && (
          // the door leaf, swung open
          <div
            style={{
              position: "absolute",
              left: -12,
              top: -2,
              width: 70,
              height: 362,
              background: "#232a45",
              borderRadius: "60px 0 0 0",
              transform: "skewY(-12deg)",
              transformOrigin: "left top",
            }}
          />
        )}
      </div>
    </div>
  );
}

function Levers({ bits }: { bits: string }) {
  return (
    <div style={{ display: "flex", gap: 18, marginTop: 26 }}>
      {bits.split("").map((b, i) => (
        <div
          key={i}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            background: b === "1" ? AMBER : "rgba(255,255,255,0.14)",
            boxShadow: b === "1" ? "0 0 24px 4px rgba(252,211,77,0.55)" : "none",
          }}
        />
      ))}
    </div>
  );
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "10px 22px",
        borderRadius: 999,
        border: `2px solid ${color}`,
        color,
        fontSize: 26,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 2,
      }}
    >
      {text}
    </div>
  );
}

export async function ogCard({
  eyebrow,
  title,
  subtitle,
  pills = [],
  open = true,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  pills?: { text: string; color: string }[];
  open?: boolean;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: `radial-gradient(circle at 78% 40%, #2b3459 0%, ${BG} 60%)`,
          color: "white",
          padding: "64px 72px",
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", paddingRight: 40 }}>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 900, letterSpacing: -0.5 }}>
            <span>CRACK&nbsp;</span>
            <span style={{ color: AMBER }}>THE&nbsp;</span>
            <span>RULE</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, letterSpacing: 4, color: AMBER, textTransform: "uppercase", fontWeight: 700 }}>{eyebrow}</div>
            <div style={{ display: "flex", fontSize: title.length > 28 ? 64 : 78, fontWeight: 900, lineHeight: 1.02, marginTop: 18, letterSpacing: -2 }}>{title}</div>
            <div style={{ display: "flex", fontSize: 32, color: "rgba(255,255,255,0.72)", marginTop: 22, lineHeight: 1.3 }}>{subtitle}</div>
            {pills.length > 0 && <div style={{ display: "flex", gap: 14, marginTop: 30 }}>{pills.map((p) => <Pill key={p.text} {...p} />)}</div>}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,0.5)" }}>cracktherule.vercel.app · free, no signup</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 340 }}>
          <Door open={open} />
          <Levers bits={open ? "101100" : "010010"} />
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}
