import { bande, BANDE_TEXTE, critereLabel } from "@/lib/offers";
import type { Bande, Breakdown } from "@/lib/offers";

/**
 * Le bulletin, composé comme un relevé de notes.
 *
 * JobBot affirme une chose qu'aucun concurrent n'affirme : **le total est exactement la somme de
 * ses lignes**. Tant que le bulletin ressemblait à une liste de barres de progression, cette
 * affirmation restait une phrase dans une page méthode. En relevé, elle se vérifie à l'œil.
 *
 * La forme est choisie, pas décorative. Un relevé de notes est le document que tout étudiant
 * français sait lire sans mode d'emploi : une colonne de matières, une colonne de notes, un
 * barème, un trait, une moyenne, une appréciation. Reprendre cette grammaire évite d'avoir à
 * expliquer comment lire la page — et aucun autre site d'emploi ne le fait.
 *
 * **Deux groupes au lieu d'un.** Les critères qui rapportent et les ajustements qui retranchent
 * étaient mêlés dans une seule liste, ce qui produisait des lignes « 0 sur 0 » impossibles à
 * interpréter : on les lisait comme un défaut d'affichage. Ils sont désormais séparés, avec leur
 * propre intitulé. Rien n'est retiré du total : les deux groupes s'additionnent toujours.
 */

/** L'appréciation, en un mot. Elle suit la bande réelle, elle n'ajoute aucun jugement. */
const APPRECIATION: Record<Bande, string> = {
  excellent: "Très bonne piste",
  bon: "Bonne piste",
  moyen: "Piste partielle",
  faible: "À examiner",
};

function Ligne({ b, ajustement }: { b: Breakdown; ajustement: boolean }) {
  const vide = b.points === 0;
  return (
    <div className="grid grid-cols-[1fr_3.5rem_3.5rem] items-baseline gap-x-3 border-b border-line/50 py-2">
      <div className="min-w-0">
        <span className={`text-sm ${vide ? "text-muted" : "text-ink-soft"}`}>
          {critereLabel(b.critere)}
        </span>
        {b.detail ? <div className="text-xs text-muted">{b.detail}</div> : null}
      </div>
      <span
        className={`text-right font-mono text-sm tabular-nums ${
          vide ? "text-muted" : b.points < 0 ? "font-medium text-bad" : "font-medium text-ink"
        }`}
      >
        {b.points > 0 && ajustement ? "+" : ""}
        {b.points}
      </span>
      <span className="text-right font-mono text-sm tabular-nums text-muted">
        {ajustement ? "—" : b.max}
      </span>
    </div>
  );
}

export function Bulletin({ breakdown }: { breakdown: Breakdown[] | null }) {
  if (!breakdown || breakdown.length === 0) {
    return (
      <p className="text-sm text-muted">
        Décomposition non disponible pour cette offre : la source ne fournit pas assez
        d&apos;informations pour la calculer.
      </p>
    );
  }

  // Un ajustement est une ligne dont le barème est nul : elle ne peut que retrancher.
  const notes = breakdown.filter((b) => b.max > 0);
  const ajustements = breakdown.filter((b) => b.max === 0);

  const total = breakdown.reduce((s, b) => s + b.points, 0);
  const max = breakdown.reduce((s, b) => s + b.max, 0);
  const retire = ajustements.reduce((s, b) => s + b.points, 0);
  const b = bande(total);

  return (
    <div>
      <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-x-3 border-b border-line-strong pb-1.5">
        <span className="label">Critère</span>
        <span className="label text-right">Note</span>
        <span className="label text-right">Barème</span>
      </div>

      {notes.map((l) => (
        <Ligne key={l.critere} b={l} ajustement={false} />
      ))}

      {ajustements.length > 0 ? (
        <>
          <div className="mt-5 border-b border-line-strong pb-1.5">
            <span className="label">
              Ajustements{retire !== 0 ? ` · ${retire} point${retire <= -2 ? "s" : ""}` : ""}
            </span>
          </div>
          {ajustements.map((l) => (
            <Ligne key={l.critere} b={l} ajustement />
          ))}
        </>
      ) : null}

      {/* Filet double : en comptabilité, il annonce qu'on additionne au-dessus. C'est ce qui
          transforme une liste en addition, et une affirmation en démonstration. */}
      <div className="mt-1 grid grid-cols-[1fr_3.5rem_3.5rem] items-baseline gap-x-3 border-t-[3px] border-double border-line-strong pt-3">
        <span className="label text-ink">Total</span>
        <span className="text-right font-display text-xl font-light leading-none tabular-nums text-ink">
          {total}
        </span>
        <span className="text-right font-mono text-sm tabular-nums text-muted">{max}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="label">Appréciation</span>
        <span className="text-sm text-ink-soft" title={BANDE_TEXTE[b]}>
          {APPRECIATION[b]}
        </span>
      </div>

      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
        Additionne la colonne « Note » : tu dois retrouver {total}. Aucun coefficient caché, aucun
        arrondi de faveur. Ce chiffre dit la correspondance avec ton profil, pas tes chances
        d&apos;être recruté : cette décision appartient à l&apos;employeur.
      </p>
    </div>
  );
}
