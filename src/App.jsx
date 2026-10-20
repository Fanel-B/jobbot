// Page de maintenance. Aucun appel reseau, aucun formulaire.
// L'interface v1 est conservee dans src/legacy/App.v1.jsx et n'est plus importee.

const bg = "#0a0a0f";
const card = "#1c1c2a";
const border = "#333345";
const text = "#e8e8f0";
const dim = "#a8a8bd";
const muted = "#444460";
const accent = "#2563eb";

export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: bg,
        color: text,
        fontFamily: "system-ui,sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <main
        style={{
          width: "100%",
          maxWidth: 520,
          background: card,
          border: `1px solid ${border}`,
          borderRadius: 14,
          padding: "30px 26px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 22 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            🎯
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>JobBot Alternance</div>
            <div style={{ fontSize: 11, color: muted, fontFamily: "monospace" }}>Projet personnel · L3 MIAGE</div>
          </div>
        </div>

        <h1 style={{ fontSize: 21, fontWeight: 600, lineHeight: 1.3, marginBottom: 14 }}>
          JobBot est en amélioration
        </h1>

        <p style={{ fontSize: 14, lineHeight: 1.65, color: dim, marginBottom: 24 }}>
          La première version générait des offres d&apos;alternance simulées par une IA. Je prépare
          une version avec de vraies offres issues d&apos;APIs officielles (La Bonne Alternance,
          France Travail). Le code de la v1 reste visible sur GitHub.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          <a
            href="https://github.com/Fanel-B/jobbot"
            target="_blank"
            rel="noreferrer noopener"
            style={{
              padding: "9px 14px",
              borderRadius: 9,
              border: "none",
              background: accent,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Voir le code sur GitHub
          </a>
          <a
            href="https://portfolio-v2-fanel-65.vercel.app"
            style={{
              padding: "9px 14px",
              borderRadius: 9,
              border: `1px solid ${border}`,
              color: dim,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Retour au portfolio
          </a>
        </div>
      </main>
    </div>
  );
}
