import { bande, BANDE_TEXTE, critereLabel } from "@/lib/offers";
import type { Bande, Breakdown } from "@/lib/offers";
import { enDeuxGroupes, estConstant, type Groupe } from "@/lib/groupes";

/**
 * Le bulletin, composé comme un relevé de notes, en deux groupes de matières.
 *
 * JobBot affirme une chose qu'aucun concurrent n'affirme : le total est exactement la somme de
 * ses lignes. En relevé, cette affirmation se vérifie à l'oeil plutôt que de rester une phrase
 * dans une page méthode.
 *
 * La forme est choisie, pas décorative. Un relevé est le document que tout étudiant français
 * sait lire sans mode d'emploi. L'objection qui avait été posée, qu'un relevé n'a pas deux
 * moyennes générales, tombe dès qu'on regarde un vrai bulletin : il porte des moyennes par
 * groupe de matières, puis une moyenne générale. La convention autorise donc exactement ce dont
 * le produit avait besoin.
 *
 * Les deux groupes répondent au défaut central de la note. Sur cent points, trente seulement
 * regardaient la personne ; les soixante-dix autres notaient l'annonce, identiques pour tout le
 * monde. Mélangés, ils donnaient un chiffre flatteur à quelqu'un dont le profil était vide.
 * Séparés, le lecteur voit enfin ce qui vient de lui.
 *
 * Les lignes qui ne départagent rien sont grisées et annotées plutôt que supprimées : les
 * retirer du total ferait afficher au site un chiffre différent de celui du moteur Python, ce
 * qu'un projet fondé sur l'accord des deux ne peut pas se permettre.
 */

/** L'appréciation, en un mot. Elle suit la bande déjà calculée et n'ajoute aucun jugement. */
const APPRECIATION: Record<Bande, string> = {
  excellent: "Très bonne piste",
  bon: "Bonne piste",
  moyen: "Piste partielle",
  faible: "À examiner",
};

function Ligne({ b }: { b: Breakdown }) {
  const ajustement = b.max === 0;
  const mort = estConstant(b.critere);
  const vide = b.points === 0;

  return (
    <div
      className={`grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-b border-line/50 py-2 sm:grid-cols-[1fr_3rem_3rem] ${
        mort ? "opacity-55" : ""
      }`}
    >
      <div className="min-w-0">
        <span className={`text-sm ${vide || mort ? "text-muted" : "text-ink-soft"}`}>
          {critereLabel(b.critere)}
        </span>
        {b.detail ? <div className="text-xs leading-snug text-muted">{b.detail}</div> : null}
        {mort ? (
          <div className="text-xs italic text-muted">ne départage aucune offre</div>
        ) : null}
      </div>

      {/* Sur un téléphone, note et barème partagent une seule cellule alignée à droite :
          trois colonnes à 390 pixels poussent le nom du critère à se casser en quatre lignes. */}
      <div className="flex items-baseline gap-1 font-mono text-sm tabular-nums sm:contents">
        <span
          className={`sm:text-right ${
            vide || mort ? "text-muted" : b.points < 0 ? "font-medium text-bad" : "font-medium text-ink"
          }`}
        >
          {b.points > 0 && ajustement ? "+" : ""}
          {b.points}
        </span>
        {/* Un ajustement n'a pas de barème : la cellule reste vide plutôt que de porter un
            signe qui ferait croire à une valeur. L'intitulé du groupe le dit déjà. */}
        {ajustement ? (
          <span className="hidden sm:block" aria-hidden />
        ) : (
          <span className="text-muted sm:text-right">
            <span className="sm:hidden">/</span>
            {b.max}
          </span>
        )}
      </div>
    </div>
  );
}

function SectionGroupe({ g }: { g: Groupe }) {
  const gagnes = g.lignes.reduce((t, l) => t + Math.max(0, l.points), 0);
  const retires = g.lignes.reduce((t, l) => t + Math.min(0, l.points), 0);

  return (
    <section className="mt-7 first:mt-0">
      <div className="border-b border-line-strong pb-1.5">
        <div className="grid grid-cols-[1fr_auto] gap-x-4 sm:grid-cols-[1fr_3rem_3rem]">
          <span className="label text-ink">{g.titre}</span>
          <span className="label hidden text-right sm:block">Note</span>
          <span className="label hidden text-right sm:block">Barème</span>
        </div>
        <p className="mt-1 text-xs leading-snug text-muted">{g.explication}</p>
      </div>

      {g.lignes.map((l) => (
        <Ligne key={l.critere} b={l} />
      ))}

      <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-t border-line pt-2 sm:grid-cols-[1fr_3rem_3rem]">
        <span className="text-xs text-muted">Sous-total</span>
        <div className="flex items-baseline gap-1 font-mono text-sm tabular-nums sm:contents">
          <span className={`font-medium sm:text-right ${g.points < 0 ? "text-bad" : "text-ink"}`}>
            {g.points}
          </span>
          <span className="text-muted sm:text-right">
            <span className="sm:hidden">/</span>
            {g.max}
          </span>
        </div>
      </div>

      {/* Un sous-total négatif, et c'est fréquent : sur un profil vide, 100 des 191 offres
          notables en affichent un, jusqu'à moins vingt et un. Un relevé scolaire n'a pas de
          note négative, donc le nombre nu ne veut rien dire pour qui le lit.

          Le choix retenu est de ne pas le ramener à zéro. Un plancher ferait afficher un
          sous-total qui ne serait plus la somme de ses lignes, c'est-à-dire exactement la
          promesse que le produit tient et que personne d'autre ne tient. On garde donc le
          chiffre vrai et on montre d'où il vient : tant de points gagnés, tant de retirés. */}
      {retires < 0 ? (
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          <span className="num text-good">{gagnes}</span> gagné{gagnes > 1 ? "s" : ""} et{" "}
          <span className="num text-bad">{retires}</span> retiré{retires < -1 ? "s" : ""} par les
          ajustements.
          {g.points < 0
            ? " Ce n'est pas une note sur toi : l'annonce exige plus que ce que tu as confirmé."
            : ""}
        </p>
      ) : null}
    </section>
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

  const r = enDeuxGroupes(breakdown);
  const b = bande(r.total);

  return (
    <div>
      <SectionGroupe g={r.toi} />
      <SectionGroupe g={r.annonce} />

      {/* Filet double : en comptabilité, il annonce qu'on additionne au-dessus. C'est ce qui
          transforme une liste en addition, et une affirmation en démonstration. */}
      <div className="mt-6 grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-t-[3px] border-double border-line-strong pt-3.5 sm:grid-cols-[1fr_3rem_3rem]">
        <span className="label text-ink">Total</span>
        <div className="flex items-baseline gap-1 tabular-nums sm:contents">
          <span className="font-display text-2xl font-light leading-none text-ink sm:text-right">
            {r.total}
          </span>
          <span className="font-mono text-sm text-muted sm:text-right">
            <span className="sm:hidden">/</span>
            {r.max}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="label">Appréciation</span>
        <span className="text-sm text-ink-soft" title={BANDE_TEXTE[b]}>
          {APPRECIATION[b]}
        </span>
      </div>

      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
        {r.toi.points} plus {r.annonce.points} font {r.total} : les deux sous-totaux
        s&apos;additionnent, sans coefficient caché ni arrondi de faveur. Ce chiffre dit la
        correspondance avec ton profil, pas tes chances d&apos;être recruté : cette décision
        appartient à l&apos;employeur.
      </p>
    </div>
  );
}
