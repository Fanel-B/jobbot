import Link from "next/link";
import { OfferMini } from "@/components/OfferCard";
import { Bulletin } from "@/components/Bulletin";
import { ScoreBadge } from "@/components/ScoreBadge";
import {
  ageJours,
  lacunesRegroupees,
  meta,
  nbSignalFormation,
  offresAvecContrat,
  offresSansContrat,
  sourceLabel,
  top,
} from "@/lib/offers";

export default function Home() {
  const meilleures = top(6);
  const reference = meilleures[0];
  // Le signal n'est compté que s'il peut citer son extrait : un drapeau sans citation
  // n'est pas une offre signalée, c'est une donnée incomplète.
  const nbFormation = nbSignalFormation([...offresAvecContrat, ...offresSansContrat]);
  const totalCollecte = offresAvecContrat.length + offresSansContrat.length;
  // Zéro est un résultat, pas un vide : on le dit, plutôt que d'afficher « 0 offre(s) ».
  const texteFormation =
    nbFormation === 0
      ? `Sur les ${totalCollecte} annonces de cette collecte, aucune ne déclenche ce signal.`
      : `${nbFormation} annonce${nbFormation > 1 ? "s" : ""} le déclenche${nbFormation > 1 ? "nt" : ""} dans cette collecte.`;
  const vues7j = offresAvecContrat.filter((o) => {
    const j = ageJours(o);
    return j !== null && j <= 7;
  }).length;

  // Ce qui revient le plus souvent dans les offres et qui n'est pas au profil.
  // Regroupé par famille : « IA », « intelligence artificielle » et « IA générative » sont une chose.
  const lacunes = lacunesRegroupees(offresAvecContrat, 8);

  const sources = Object.entries(meta.sources).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      {/* ------------------------------------------------------------ ouverture */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 pb-14 pt-16">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Alternance · Stage · Toulouse et Île-de-France
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Les offres qui te correspondent vraiment.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft">
            JobBot lit les annonces publiées par les entreprises et les sources officielles, puis
            explique chaque correspondance <strong className="font-medium">critère par critère</strong>
            {" "}— ce qui colle, ce qui manque, et ce que ça veut dire avant de postuler.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/offres?zone=toulouse&tri=score"
              className="rounded-lg bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft"
            >
              Voir les {meta.zones.toulouse} offres à Toulouse
            </Link>
            <Link
              href="/offres?zone=idf&tri=score"
              className="rounded-lg border border-line-strong bg-surface px-5 py-3 text-sm font-medium text-ink transition hover:border-ink/30"
            >
              Île-de-France ({meta.zones.idf})
            </Link>
            <Link
              href="/methode"
              className="px-2 py-3 text-sm font-medium text-accent underline decoration-accent/30"
            >
              Comment la note est calculée
            </Link>
          </div>

          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-8 sm:grid-cols-4">
            {[
              { k: "Offres en base", v: meta.count },
              { k: "Toulouse et alentours", v: meta.zones.toulouse },
              { k: "Île-de-France", v: meta.zones.idf },
              { k: "Vues ces 7 derniers jours", v: vues7j },
            ].map((s) => (
              <div key={s.k}>
                <dd className="num font-display text-3xl leading-none">{s.v}</dd>
                <dt className="mt-2 text-xs uppercase tracking-wide text-muted">{s.k}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted">
            Chiffres réels, relevés à la dernière collecte du{" "}
            {new Date(meta.generated_at).toLocaleString("fr-FR")}. Aucune donnée de démonstration.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------- meilleures offres */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl">Le haut du classement aujourd&apos;hui</h2>
            <p className="mt-1.5 text-sm text-muted">
              Six offres, six notes, et pour chacune le détail qui les justifie.
            </p>
          </div>
          <Link href="/offres" className="text-sm text-accent underline decoration-accent/30">
            Voir les {meta.count} offres
          </Link>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meilleures.map((o) => (
            <OfferMini key={o.id} offre={o} />
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- le bulletin */}
      {reference ? (
        <section className="border-y border-line bg-paper-deep/50">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <h2 className="font-display text-3xl">Une note, neuf raisons</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
                La note n&apos;est pas une impression : elle additionne neuf critères calculés par du
                code, tous reproductibles. Chaque offre porte son bulletin, y compris quand un
                critère tombe à zéro — c&apos;est justement l&apos;information utile.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-ink-soft">
                <li>
                  <span className="font-medium">Cohérence</span> — combien des compétences demandées
                  sont déjà dans ton profil.
                </li>
                <li>
                  <span className="font-medium">Métier et source</span> — le poste visé, et la
                  fiabilité de l&apos;annonce.
                </li>
                <li>
                  <span className="font-medium">Calendrier, dépôt, dossier</span> — compatible avec
                  tes dates, formulaire rapide, pièces déjà prêtes.
                </li>
                <li>
                  <span className="font-medium">Diversité et fraîcheur</span> — pour ne pas envoyer
                  six candidatures au même endroit et pour viser les annonces vivantes.
                </li>
              </ul>
              <Link
                href="/methode"
                className="mt-7 inline-block text-sm text-accent underline decoration-accent/30"
              >
                Le détail de la méthode
              </Link>
            </div>

            <div className="card p-6">
              <p className="text-xs uppercase tracking-wide text-muted">
                Exemple réel — bulletin complet
              </p>
              <h3 className="mt-2 text-[15px] font-medium leading-snug">
                {reference.title ?? "Offre"}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">
                {reference.company ?? "—"} · {reference.location ?? "lieu non précisé"}
              </p>
              <div className="mt-4 flex items-center gap-4">
                <ScoreBadge score={reference.score} taille="lg" />
              </div>
              <div className="mt-5">
                <Bulletin breakdown={reference.score_breakdown} />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------ les lacunes */}
      {lacunes.length > 0 ? (
        <section className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="font-display text-3xl">Ce qui revient dans les offres, et pas ton CV</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Compté sur les {offresAvecContrat.length} offres classées, en reprenant les compétences
            explicitement demandées par les annonces. Ces chiffres disent quoi travailler en premier —
            pas une note sur toi.
          </p>
          <ul className="mt-7 space-y-3">
            {lacunes.map((l) => {
              const pct = Math.round((l.n / offresAvecContrat.length) * 100);
              return (
                <li key={l.label} className="grid grid-cols-[8rem_1fr_4.5rem] items-center gap-4">
                  <span className="truncate text-sm font-medium text-ink-soft">{l.label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-paper-deep">
                    <span
                      className="block h-full rounded-full bg-ink/70"
                      style={{ width: `${Math.max(pct, 3)}%` }}
                    />
                  </span>
                  <span className="num text-right text-xs text-muted">
                    {l.n} offre{l.n > 1 ? "s" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* -------------------------------------------------------- différenciateurs */}
      <section className="border-t border-line bg-paper-deep/50">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="font-display text-3xl">Ce que les outils américains ne peuvent pas faire</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                t: "Le signal « formation imposée »",
                d: `Un stage publié par un organisme de formation qui impose son école, c'est du sourcing, pas un poste. JobBot le repère et le dit, toujours en citant l'extrait qui a déclenché le signal. ${texteFormation}`,
              },
              {
                t: "Les règles françaises d'éligibilité",
                d: "Durée minimale, date de début, niveau requis : ce sont les conventions françaises qui décident, pas un score générique importé d'un autre marché.",
              },
              {
                t: "Les sources officielles",
                d: "La Bonne Alternance et France Travail ont des interfaces publiques et gratuites. Là où Teal ou Jobscan s'arrêtent aux annonces anglo-saxonnes.",
              },
            ].map((b) => (
              <div key={b.t} className="card p-5">
                <h3 className="text-[15px] font-medium">{b.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ honnêteté */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="card p-6">
            <p className="text-xs uppercase tracking-wide text-muted">Sans compte</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Toutes les offres, triées par date, avec la source et la date de collecte. Le lien vers
              l&apos;annonce d&apos;origine est toujours là.
            </p>
          </div>
          <div className="card p-6">
            <p className="text-xs uppercase tracking-wide text-muted">Avec un compte</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Les <strong className="font-medium">mêmes offres</strong>, triées par ce qui te
              correspond — le détail de la note, les compétences qui manquent, et la version de CV à
              envoyer. Nous ne prétendons pas avoir de meilleures offres que les autres.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
          <p className="max-w-xl text-sm text-muted">
            Les sources interrogées aujourd&apos;hui :{" "}
            {sources.map(([s, n]) => `${sourceLabel(s)} (${n})`).join(" · ")}. L&apos;Île-de-France est
            ouverte sur le site ; la collecte y est encore en cours d&apos;extension, l&apos;essentiel
            des offres vient aujourd&apos;hui de Toulouse et sa région.
          </p>
          <Link
            href="/offres"
            className="rounded-lg bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft"
          >
            Explorer les offres
          </Link>
        </div>
      </section>
    </div>
  );
}
