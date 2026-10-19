import { Bar } from "@/components/ScoreBadge";
import { critereLabel } from "@/lib/offers";
import type { Breakdown } from "@/lib/offers";

/**
 * Le bulletin : la décomposition de la note, critère par critère.
 *
 * C'est la promesse du produit — « un score expliqué, pas un chiffre opaque » — donc
 * chaque ligne montre les points obtenus, le maximum possible et, quand la source
 * en fournit un, le détail (« 2 sur 3 exigences couvertes »).
 */
export function Bulletin({ breakdown }: { breakdown: Breakdown[] | null }) {
  if (!breakdown || breakdown.length === 0) {
    return (
      <p className="text-sm text-muted">
        Décomposition non disponible pour cette offre : la source ne fournit pas assez
        d&apos;informations pour la calculer.
      </p>
    );
  }

  const total = breakdown.reduce((s, b) => s + b.points, 0);
  const max = breakdown.reduce((s, b) => s + b.max, 0);

  return (
    <div>
      <ul className="divide-y divide-line">
        {breakdown.map((b) => (
          <li key={b.critere} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 py-2.5">
            <div className="min-w-0">
              <span className="text-sm text-ink-soft">{critereLabel(b.critere)}</span>
              {b.detail ? (
                <span className="ml-2 text-xs text-muted">{b.detail}</span>
              ) : null}
            </div>
            <span className="num text-sm font-medium text-ink">
              {b.points}
              <span className="text-muted">/{b.max}</span>
            </span>
            <div className="col-span-2">
              <Bar points={b.points} max={b.max} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
        <span className="text-muted">Total</span>
        <span className="num font-semibold">
          {total}
          <span className="text-muted">/{max}</span>
        </span>
      </div>
    </div>
  );
}
