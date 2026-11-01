import { couverturePour, estVide, lireProfil } from "@/lib/profil";

/**
 * Ce que l'annonce demande, face au profil de la personne qui regarde.
 *
 * Ce composant existe pour réparer une contradiction visible à l'oeil sur une seule page. La
 * fiche lisait `offre.skills` dans l'export, un champ que le pipeline calcule avec les 31
 * compétences de Fanel figées dans le moteur. Elle annonçait donc « Python, déjà dans ton
 * profil » à un ami connecté, pendant que le relevé, dans la colonne d'à côté, comptait
 * « 0 sur 3 exigences » et mettait 4 sur 30. Les deux moitiés de la même page parlaient de deux
 * personnes différentes.
 *
 * La couverture vient maintenant de `classementPour(profil)`, la même source que le relevé.
 * C'est la condition pour que les deux colonnes ne puissent plus diverger : une seule vérité,
 * recalculée à la lecture, jamais stockée.
 *
 * Le composant lit un cookie, donc il doit vivre dans une frontière <Suspense> : avec
 * `cacheComponents`, une lecture de requête dans la coquille pré-rendue fait échouer le build.
 *
 * Sans profil, aucune phrase ne parle de « ton profil ». L'annonce liste ce qu'elle demande,
 * sans jugement : il n'y a pas de profil dont ces technologies seraient absentes.
 */
export async function ExigencesDuProfil({ offreId }: { offreId: number }) {
  const profil = await lireProfil();
  const { exigences, manquants } = couverturePour(profil, offreId);
  if (exigences.length === 0) return null;

  const vierge = estVide(profil);
  const absentes = new Set(manquants.map((m) => m.toLowerCase()));

  return (
    <section className="mt-9">
      <h2 className="label">
        {vierge ? "Ce que l'offre demande" : "Ce que l'offre demande, face à ton profil"}
      </h2>

      {vierge ? (
        <p className="mt-2 text-sm text-muted">
          Coche tes compétences et cette liste dira lesquelles tu as déjà.
        </p>
      ) : null}

      <ul className="mt-4 space-y-2">
        {exigences.map((e) => {
          const manque = !vierge && absentes.has(e.toLowerCase());
          return (
            /* Un filet vertical plutôt qu'une pastille cochée : la petite coche verte dans un
               carré est le motif de liste le plus vu, et la couleur n'y porte jamais seule
               l'information, le texte dit déjà lequel manque. */
            <li key={e} className="flex items-start gap-3.5 text-sm">
              <span
                className={`mt-1 h-4 w-0.5 shrink-0 rounded-sm ${
                  vierge ? "bg-line-strong" : manque ? "bg-bad" : "bg-good"
                }`}
                aria-hidden
              />
              <span className={manque || vierge ? "text-ink-soft" : "text-ink"}>
                {e}
                {vierge ? null : manque ? (
                  <span className="text-muted"> · pas encore dans ton profil</span>
                ) : (
                  <span className="text-muted"> · déjà dans ton profil</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ExigencesSquelette() {
  return (
    <section className="mt-9" aria-hidden>
      <div className="h-3 w-56 rounded bg-paper-deep" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-4 w-2/3 rounded bg-paper-deep/60" />
        ))}
      </div>
    </section>
  );
}
