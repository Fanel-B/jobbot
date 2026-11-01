import Link from "next/link";
import { offers } from "@/lib/offers";
import { competencesSimulablesPour, effetGlobalPour, type Profil } from "@/lib/profil";
import { effetDeGroupe, estNotable, rangsPour } from "@/lib/classement";
import { classementPour } from "@/lib/profil";

/**
 * Ce que vaut ton profil, en général, hors d'une offre précise.
 *
 * La page profil servait à cocher des cases et s'arrêtait là. Rien n'y disait ce que le profil
 * valait sur la collecte entière, ni ce qui lui manquait le plus. Il fallait ouvrir une offre
 * pour avoir une réponse, et cette réponse ne parlait que de cette offre.
 *
 * Deux écrans en un, parce que les deux situations n'appellent pas la même chose :
 *
 * - **Profil vide.** Montrer un écran de zéros n'a jamais donné envie à personne. On montre
 *   donc ce que cocher les cinq compétences les plus demandées changerait, mesuré sur les
 *   vraies offres. C'est une promesse vérifiable, pas un argument.
 * - **Profil rempli.** On montre où il se situe, et les lacunes classées par effet réel sur
 *   la collecte, pas par ordre alphabétique ni par fréquence brute.
 *
 * Tout vient de calculs qui existaient déjà. Rien n'est estimé.
 */
export function EtatDuProfil({ profil, vierge }: { profil: Profil; vierge: boolean }) {
  // Les lacunes, classées par ce qu'elles rapporteraient vraiment. Une techno citée partout
  // mais déjà couverte par le profil ne sert à rien : c'est l'effet qui compte, pas la mode.
  const lacunes = competencesSimulablesPour(profil, 6)
    .map((c) => ({ competence: c, effet: effetGlobalPour(profil, c) }))
    .filter((l) => l.effet.montent > 0)
    .sort((a, b) => b.effet.montent - a.effet.montent)
    .slice(0, 5);

  if (vierge) {
    // Ce que les cinq premières feraient ensemble, mesuré d'un bloc : additionner leurs effets
    // séparés compterait deux fois les offres que plusieurs d'entre elles concernent.
    const formes = lacunes.flatMap((l) => l.competence.formes);
    const ensemble = effetDeGroupe(profil, formes);
    const exemples = ensemble.meilleures
      .map((m) => offers.find((o) => o.id === m.id))
      .filter((o): o is NonNullable<typeof o> => Boolean(o));

    return (
      <section className="card mt-8 p-6">
        <h2 className="titre-section">Ce que cocher changerait</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Rien n&apos;est coché, donc rien n&apos;est classé. Si tu cochais seulement les{" "}
          <span className="num">{lacunes.length}</span> compétences les plus demandées de la
          collecte, voilà ce qui se passerait. Ce sont de vraies offres et de vrais calculs, pas
          une promesse.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
          <div>
            <dt className="label">Offres qui montent</dt>
            <dd className="chiffre mt-1">{ensemble.montent}</dd>
          </div>
          <div>
            <dt className="label">Gain moyen</dt>
            <dd className="chiffre mt-1">{ensemble.gainMoyen}</dd>
          </div>
          <div>
            <dt className="label">Passent le seuil</dt>
            <dd className="chiffre mt-1">{ensemble.franchissent}</dd>
          </div>
        </dl>

        {lacunes.length > 0 ? (
          <p className="mt-6 text-sm leading-relaxed text-muted">
            Les compétences en question :{" "}
            <strong className="font-medium text-ink-soft">
              {lacunes.map((l) => l.competence.label).join(", ")}
            </strong>
            .
          </p>
        ) : null}

        {exemples.length > 0 ? (
          <div className="mt-5 border-t border-line pt-4">
            <p className="label">Les offres qui gagneraient le plus</p>
            <ul className="mt-3 space-y-2">
              {exemples.map((o, i) => (
                <li key={o.id} className="text-sm">
                  <Link href={`/offres/${o.id}`} className="lien-anime text-accent">
                    {o.title ?? "Offre"}
                  </Link>
                  <span className="text-muted">
                    {" "}
                    · {o.company ?? "entreprise non précisée"} · plus{" "}
                    <span className="num">{ensemble.meilleures[i].gain}</span> points
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    );
  }

  const classement = classementPour(profil);
  const notables = [...classement.values()].filter((r) => estNotable(r)).length;
  const rangs = rangsPour(profil);
  const dansLePremierQuart = [...rangs.values()].filter((r) => r.rang <= r.sur / 4).length;

  return (
    <section className="card mt-8 p-6">
      <h2 className="titre-section">Où en est ton profil</h2>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
        <div>
          <dt className="label">Offres notables</dt>
          <dd className="chiffre mt-1">{notables}</dd>
        </div>
        <div>
          <dt className="label">Dans ton premier quart</dt>
          <dd className="chiffre mt-1">{dansLePremierQuart}</dd>
        </div>
        <div>
          <dt className="label">Compétences cochées</dt>
          <dd className="chiffre mt-1">{profil.competences.length}</dd>
        </div>
      </dl>

      {lacunes.length > 0 ? (
        <div className="mt-7 border-t border-line pt-5">
          <p className="label">Ce qui te manque le plus, par effet réel</p>
          <p className="mt-2 text-sm text-muted">
            Classé par ce que la compétence rapporterait sur toute la collecte, pas par sa
            fréquence. Une techno citée partout mais déjà couverte ne te rapporte rien.
          </p>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {lacunes.map((l) => (
              <li
                key={l.competence.label}
                className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 py-2.5"
              >
                <span className="text-sm text-ink-soft">{l.competence.label}</span>
                <span className="font-mono text-xs tabular-nums text-muted">
                  <span className="font-medium text-ink">{l.effet.montent}</span> offres
                  {l.effet.franchissent > 0 ? (
                    <>
                      {" "}
                      · <span className="text-good">{l.effet.franchissent}</span> au seuil
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
