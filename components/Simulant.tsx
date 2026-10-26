import Link from "next/link";
import { critereLabel } from "@/lib/offers";
import { lireSimulation } from "@/lib/simulation";
import { effetPour, lireProfil, manquantsPour } from "@/lib/profil";

type Params = { simule?: string };

/**
 * Le simulant : « et si j'apprenais X ? »
 *
 * Les compétences cochées voyagent dans l'URL (`?simule=IA,Docker`), comme les filtres de la
 * liste. Trois raisons, et aucune n'est de la paresse : la page reste utilisable sans JavaScript,
 * le résultat est partageable tel quel, et le navigateur n'a pas à télécharger le moteur de calcul
 * et les 230 offres pour recalculer une note que le serveur sait rendre déjà faite.
 *
 * Ne sont proposées que les compétences **que cette offre demande** et que le profil ne couvre
 * pas : simuler ici une compétence dont l'annonce ne parle pas ne changerait sa cohérence en rien.
 */
export async function Simulant({
  offreId,
  searchParams,
}: {
  offreId: number;
  searchParams: Promise<Params>;
}) {
  const p = await searchParams;
  // Les compétences proposées sont celles qui manquent **à ce profil**, et l'écart est mesuré
  // depuis sa note — pas depuis celle du profil d'usine.
  const profil = await lireProfil();
  const manquants = manquantsPour(profil, offreId);

  if (manquants.length === 0) {
    return (
      <section className="mt-9">
        <h2 className="label">
          Et si tu apprenais…
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Rien à simuler sur cette offre : elle ne demande aucune compétence qui manque à ton
          profil. L&apos;écart se joue ailleurs — sur le calendrier, la source ou la fraîcheur.
        </p>
      </section>
    );
  }

  const demandees = new Map(manquants.map((m) => [m.toLowerCase(), m]));
  const actives = lireSimulation(p.simule)
    .map((a) => demandees.get(a.toLowerCase()))
    .filter((a): a is string => a !== undefined);

  const effet = actives.length ? effetPour(profil, offreId, actives) : null;
  const coherence = effet?.lignesQuiBougent.find((l) => l.critere === "cohérence");
  const autres = effet?.lignesQuiBougent.filter((l) => l.critere !== "cohérence") ?? [];

  const lien = (liste: string[]) =>
    liste.length
      ? `/offres/${offreId}?simule=${encodeURIComponent(liste.join(","))}`
      : `/offres/${offreId}`;

  return (
    <section className="mt-9">
      <h2 className="label">
        Et si tu apprenais…
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Coche une compétence que tu n&apos;as pas encore : la note est recalculée par le même moteur
        que celui du classement, sans rien inventer.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {manquants.map((m) => {
          const active = actives.includes(m);
          const suivant = active ? actives.filter((a) => a !== m) : [...actives, m];
          return (
            <Link
              key={m}
              href={lien(suivant)}
              className={`inline-flex items-center gap-1.5 rounded-[6px] border px-3 py-1 text-xs transition ${
                active
                  ? "border-accent/30 bg-accent-soft text-accent-ink"
                  : "border-line bg-surface text-ink-soft hover:border-line-strong"
              }`}
            >
              <span aria-hidden>{active ? "☑" : "☐"}</span>
              {m}
            </Link>
          );
        })}
        {actives.length > 0 ? (
          <Link href={lien([])} className="px-2 py-1 text-xs text-muted underline hover:text-ink-soft">
            tout décocher
          </Link>
        ) : null}
      </div>

      {effet ? (
        <div className="mt-5 rounded-card border border-line bg-paper-deep/50 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="label">
                {critereLabel("cohérence")}
              </p>
              <p className="num mt-1 text-2xl">
                {coherence ? (
                  <>
                    <span className="text-muted">{coherence.avant}</span>
                    <span className="mx-2 text-muted" aria-hidden>
                      →
                    </span>
                    <span className="font-semibold text-good">{coherence.apres}</span>
                    <span className="text-muted">/{coherence.max}</span>
                  </>
                ) : (
                  <span className="text-muted">inchangée</span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted">
                {coherence
                  ? `+${coherence.apres - coherence.avant} point${coherence.apres - coherence.avant > 1 ? "s" : ""} : l'offre a ${actives.length === 1 ? "une exigence" : `${actives.length} exigences`} de moins hors de ta portée.`
                  : "Ces compétences ne changent pas la couverture des exigences de cette offre."}
              </p>
            </div>

            <div>
              <p className="label">Note de l&apos;offre</p>
              <p className="num mt-1 text-2xl">
                <span className="text-muted">{effet.totalAvant}</span>
                <span className="mx-2 text-muted" aria-hidden>
                  →
                </span>
                <span
                  className={`font-semibold ${
                    effet.totalApres > effet.totalAvant
                      ? "text-good"
                      : effet.totalApres < effet.totalAvant
                        ? "text-warn"
                        : "text-ink"
                  }`}
                >
                  {effet.totalApres}
                </span>
                <span className="text-muted">/100</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                Somme exacte du bulletin recalculé, comme pour la note affichée.
              </p>
            </div>
          </div>

          {/* La diversité répartit les candidatures entre employeurs : elle dépend du classement
              entier, donc une note qui monte peut en faire descendre une autre. Le taire
              donnerait un total qui ne s'explique pas par ses lignes. */}
          {autres.length > 0 ? (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-sm font-medium text-ink">
                {autres.length === 1 ? "Une autre ligne bouge" : "D'autres lignes bougent"}
              </p>
              <ul className="mt-2 space-y-1">
                {autres.map((l) => (
                  <li key={l.critere} className="text-sm text-ink-soft">
                    <span className="text-muted">{critereLabel(l.critere)} : </span>
                    <span className="num">
                      {l.avant} → {l.apres}/{l.max}
                    </span>
                    {(() => {
                      const detail = effet.bulletinApres.find((b) => b.critere === l.critere)?.detail;
                      return detail ? <span className="text-muted"> — {detail}</span> : null;
                    })()}
                  </li>
                ))}
              </ul>
              {autres.some((l) => l.critere === "diversité") ? (
                <p className="mt-2.5 max-w-2xl text-xs leading-relaxed text-muted">
                  La diversité ne mesure pas ton profil : elle évite que tes candidatures se
                  concentrent sur un même employeur. Elle se redistribue dès que ton classement
                  change — apprendre cette compétence fait monter d&apos;autres offres, et celle-ci
                  peut perdre sa place au profit d&apos;une annonce d&apos;une autre entreprise.
                </p>
              ) : null}
            </div>
          ) : null}

          {effet.manquantsApres.length > 0 ? (
            <p className="mt-4 border-t border-line pt-4 text-xs text-muted">
              Resterait à travailler pour cette offre : {effet.manquantsApres.join(", ")}.
            </p>
          ) : (
            <p className="mt-4 border-t border-line pt-4 text-xs text-good">
              Avec {actives.length === 1 ? "cette compétence" : "ces compétences"}, l&apos;offre ne
              demande plus rien qui manque à ton profil.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** Même silhouette pendant que le serveur recalcule : la page ne doit pas sauter. */
export function SimulantSquelette() {
  return (
    <section className="mt-9" aria-hidden>
      <div className="h-3 w-40 rounded bg-paper-deep" />
      <div className="mt-4 h-4 w-96 max-w-full rounded bg-paper-deep/70" />
      <div className="mt-4 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-6 w-20 rounded-full bg-paper-deep" />
        ))}
      </div>
    </section>
  );
}
