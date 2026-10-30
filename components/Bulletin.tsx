import { critereLabel } from "@/lib/offers";
import type { Breakdown } from "@/lib/offers";

/**
 * Le bulletin, composé comme un relevé de notes.
 *
 * C'est la seule chose que JobBot affirme et qu'aucun concurrent n'affirme : **le total est
 * exactement la somme de ses lignes**. Tant que le bulletin ressemblait à une liste de barres de
 * progression, cette affirmation restait une phrase dans une page méthode. Mise en relevé, elle
 * se vérifie à l'œil : une colonne de points, un filet double au-dessus du total — la convention
 * comptable qui annonce une addition — et le résultat en bas.
 *
 * Les barres de progression par ligne ont disparu. Elles donnaient quinze gradients colorés pour
 * quinze lignes, soit beaucoup de peinture pour une information que la colonne « points sur
 * barème » donne exactement. Ce qui reste du signal visuel tient dans la couleur du chiffre :
 * encre quand la ligne rapporte, atténué quand elle vaut zéro.
 *
 * Les critères d'ajustement — ceux dont le maximum est zéro et qui ne peuvent que retrancher —
 * sont marqués d'un signe. Sans ça, une ligne « 0 sur 0 » se lit comme une erreur d'affichage.
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
      <div className="flex items-baseline justify-between border-b border-line pb-2">
        <span className="label">Critère</span>
        <span className="label">Points</span>
      </div>

      <ul>
        {breakdown.map((b) => {
          const ajustement = b.max === 0;
          const vide = b.points === 0;
          return (
            <li
              key={b.critere}
              className="grid grid-cols-[1fr_auto] items-baseline gap-x-5 border-b border-line/60 py-2.5"
            >
              <div className="min-w-0">
                <span className={`text-sm ${vide ? "text-muted" : "text-ink-soft"}`}>
                  {critereLabel(b.critere)}
                </span>
                {b.detail ? <span className="ml-2 text-xs text-muted">{b.detail}</span> : null}
              </div>

              <span
                className={`font-mono text-sm tabular-nums ${
                  vide ? "text-muted" : "font-medium text-ink"
                }`}
              >
                {ajustement ? (
                  <>
                    {b.points > 0 ? "+" : ""}
                    {b.points}
                    <span className="text-muted"> ajust.</span>
                  </>
                ) : (
                  <>
                    {b.points}
                    <span className="text-muted">/{b.max}</span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Filet double : en comptabilité, il annonce qu'on additionne au-dessus. C'est ce qui
          transforme une liste en addition, et l'affirmation du produit en démonstration. */}
      <div className="mt-0.5 flex items-baseline justify-between border-t-[3px] border-double border-line-strong pt-3">
        <span className="label text-ink-soft">Total</span>
        <span className="font-display text-2xl font-light leading-none tabular-nums text-ink">
          {total}
          <span className="ml-0.5 font-mono text-[11px] font-normal text-muted">/{max}</span>
        </span>
      </div>

      <p className="mt-2.5 text-xs text-muted">
        Additionne la colonne : tu dois retrouver {total}. Aucun coefficient caché, aucun
        arrondi de faveur.
      </p>
    </div>
  );
}
