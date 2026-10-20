import { bande, BANDE_CLASSE, BANDE_TEXTE } from "@/lib/offers";

/**
 * La note. Toujours accompagnée de sa lecture en clair : jamais un chiffre nu.
 */
export function ScoreBadge({
  score,
  taille = "md",
}: {
  score: number | null;
  taille?: "md" | "lg";
}) {
  const b = bande(score);
  const grand = taille === "lg";
  return (
    <div
      className={`shrink-0 rounded-xl border ${BANDE_CLASSE[b]} ${
        grand ? "px-4 py-3" : "px-3 py-2"
      } text-center`}
      title={BANDE_TEXTE[b]}
    >
      <div
        className={`num font-semibold leading-none ${grand ? "text-3xl" : "text-xl"}`}
      >
        {score ?? "—"}
      </div>
      {grand ? (
        <div className="mt-1 text-xs font-medium">{BANDE_TEXTE[b]}</div>
      ) : (
        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide opacity-70">
          / 100
        </div>
      )}
    </div>
  );
}

/** Barre de progression d'un critère du bulletin. */
export function Bar({ points, max }: { points: number; max: number }) {
  const pct = max > 0 ? Math.round((points / max) * 100) : 0;
  const couleur =
    pct >= 80 ? "bg-good" : pct >= 55 ? "bg-accent" : pct >= 30 ? "bg-warn" : "bg-line-strong";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-deep">
      <div className={`h-full rounded-full ${couleur}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
