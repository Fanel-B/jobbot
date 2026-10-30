/**
 * Les deux graphiques du site. Rendus côté serveur, en HTML et CSS : aucune bibliothèque,
 * aucun JavaScript, et la page reste lisible sans lui. Le survol passe par `title`, que le
 * navigateur affiche nativement.
 *
 * Les formes suivent la règle du métier plutôt que l'envie :
 *   · comparer des grandeurs → des barres, **une seule teinte**. Colorer chaque barre selon
 *     sa valeur re-dirait en couleur ce que la longueur dit déjà, et dépenserait le seul
 *     canal qui sert à distinguer des séries ;
 *   · un avant → après par ligne → un dumbbell, une teinte en deux nuances.
 *
 * Une toile d'araignée a été écartée : ses axes n'ont pas d'ordre naturel et l'aire qu'elle
 * dessine exagère les grands écarts. Sur « IA 93 contre AWS 5 », elle mentirait à l'œil.
 */

const PISTE = "relative h-3 flex-1 rounded-full bg-paper-deep";

/* ------------------------------------------------------------------ barres */

export type Barre = { label: string; valeur: number; detail?: string };

/**
 * Barres horizontales, triées, une seule teinte. L'échelle est ancrée au maximum de la
 * série : la barre la plus longue remplit la piste, les autres se lisent par rapport à elle.
 */
export function Barres({
  donnees,
  total,
  unite = "offres",
}: {
  donnees: Barre[];
  /** Base de calcul du pourcentage affiché au survol. */
  total: number;
  unite?: string;
}) {
  const max = Math.max(...donnees.map((d) => d.valeur), 1);

  return (
    <ul className="space-y-2.5">
      {donnees.map((d) => {
        const part = Math.round((d.valeur / total) * 100);
        return (
          <li
            key={d.label}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[13rem_1fr_5.5rem]"
            title={`${d.label}, ${d.valeur} ${unite} sur ${total} (${part} %)`}
          >
            <span className="truncate text-sm text-ink-soft">{d.label}</span>
            <span className={`${PISTE} order-last col-span-2 sm:order-none sm:col-span-1`}>
              <span
                className="pousse absolute inset-y-0 left-0 rounded-r-[4px] bg-trace"
                style={{ width: `${Math.max((d.valeur / max) * 100, 2)}%` }}
              />
            </span>
            <span className="text-right text-sm text-ink">
              <span className="num font-medium">{d.valeur}</span>
              <span className="num ml-1.5 text-xs text-muted">{part}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------- dumbbell */

export type Haltere = {
  label: string;
  avant: number;
  apres: number;
  /** Texte du survol, pour dire ce que les deux points veulent dire. */
  detail?: string;
};

/**
 * Dumbbell : un point pour aujourd'hui, un pour la simulation, un segment entre les deux.
 *
 * Le point « aujourd'hui » vaut la même chose sur chaque ligne — c'est le nombre d'offres
 * déjà au-dessus du seuil. Il forme donc une verticale, et seule la longueur du segment
 * varie : c'est exactement ce qu'on veut comparer.
 */
export function Dumbbell({
  donnees,
  legendeAvant,
  legendeApres,
}: {
  donnees: Haltere[];
  legendeAvant: string;
  legendeApres: string;
}) {
  const max = Math.max(...donnees.map((d) => d.apres), 1);
  const pos = (v: number) => (v / max) * 100;

  return (
    <div>
      {/* Deux séries, donc une légende : l'identité ne doit jamais tenir à la couleur seule. */}
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <span className="inline-flex items-center gap-2 text-xs text-muted">
          <span className="h-2.5 w-2.5 rounded-full bg-trace ring-2 ring-surface" />
          {legendeAvant}
        </span>
        <span className="inline-flex items-center gap-2 text-xs text-muted">
          <span className="h-2.5 w-2.5 rounded-full bg-trace-fort ring-2 ring-surface" />
          {legendeApres}
        </span>
      </div>

      <ul className="space-y-3.5">
        {donnees.map((d) => {
          const gagne = d.apres - d.avant;
          return (
            <li
              key={d.label}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[13rem_1fr_4.5rem]"
              title={d.detail ?? `${d.label} : ${d.avant} → ${d.apres}`}
            >
              <span className="truncate text-sm text-ink-soft">{d.label}</span>

              <span className="relative order-last col-span-2 h-5 sm:order-none sm:col-span-1">
                {/* la piste, et la part déjà acquise : laisser les deux tiers de gauche
                    vides donnait un graphique tassé à droite, alors que ce vide dit
                    justement « ce que tu as déjà ». */}
                <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-paper-deep" />
                <span
                  className="absolute top-1/2 h-1 -translate-y-1/2 rounded-l-full bg-trace-pale"
                  style={{ width: `${pos(d.avant)}%` }}
                />
                {/* le segment gagné */}
                <span
                  className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-trace"
                  style={{ left: `${pos(d.avant)}%`, width: `${Math.max(pos(gagne), 0)}%` }}
                />
                {/* aujourd'hui */}
                <span
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-trace ring-2 ring-surface"
                  style={{ left: `${pos(d.avant)}%` }}
                />
                {/* après simulation */}
                <span
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-trace-fort ring-2 ring-surface"
                  style={{ left: `${pos(d.apres)}%` }}
                />
              </span>

              {/* On n'étiquette que l'arrivée : une valeur sur chaque point noierait la lecture. */}
              <span className="num text-right text-sm text-ink">
                {d.apres}
                {/* Le signe « + » porte l'information autant que la couleur : le vert
                    ne fait que la redoubler, il n'en est jamais le seul support. */}
                {gagne > 0 ? <span className="text-good"> +{gagne}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
