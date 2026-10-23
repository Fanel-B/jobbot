import Link from "next/link";
import { OfferMini } from "@/components/OfferCard";
import { Bulletin } from "@/components/Bulletin";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Barres, Dumbbell } from "@/components/Graphes";
import {
  SEUIL_BONNE_PISTE,
  competencesSimulables,
  effetGlobal,
  offresAuDessus,
  volumeSuffisant,
} from "@/lib/simulation";
import {
  ageJours,
  offers,
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
  // Compté sur la collecte entière, comme les trois autres chiffres de la même rangée.
  // Le restreindre aux offres classées donnait 86 à côté d'un « 230 en base » : deux
  // dénominateurs dans la même phrase, donc un chiffre qui ne veut rien dire.
  const vues7j = offers.filter((o) => {
    const j = ageJours(o);
    return j !== null && j <= 7;
  }).length;

  // Ce qui revient le plus souvent dans les offres et qui n'est pas au profil.
  // Regroupé par famille : « IA », « intelligence artificielle » et « IA générative » sont une chose.
  // Sur la collecte entière : le simulant compte sur 230, et afficher « IA : 92 offres »
  // ici à côté de « demandée par 93 offres » plus bas serait la même chose comptée deux fois.
  const lacunes = lacunesRegroupees(offers, 8);

  const sources = Object.entries(meta.sources).sort((a, b) => b[1] - a[1]);

  // Le simulant, vu d'ensemble : ce que chaque compétence manquante changerait sur la collecte.
  // Garde-fou du cahier de route — on n'annonce un comptage que si la base en contient assez,
  // sinon « 14 offres s'ouvriraient » n'a aucun sens statistique.
  const dejaBonnes = offresAuDessus();
  const leviers = volumeSuffisant()
    ? competencesSimulables(4)
        .map((c) => ({ competence: c, effet: effetGlobal(c) }))
        .filter((l) => l.effet.franchissent > 0 || l.effet.montent > 0)
        .sort((a, b) => b.effet.franchissent - a.effet.franchissent || b.effet.montent - a.effet.montent)
    : [];

  return (
    <div>
      {/* ------------------------------------------------------------ ouverture */}
      {/* Un grand bloc arrondi posé sur le papier, sur la trame d'un cahier de notes. */}
      <section className="px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="regle bloc mx-auto max-w-[78rem] overflow-hidden border border-line">
          <div className="cascade grid gap-12 px-6 py-16 sm:px-12 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:py-20">
            <div>
              <p className="label">Alternance · Stage · Toulouse et Île-de-France</p>
              <h1 className="titre-geant mt-5 max-w-[11ch]">
                Les offres qui te correspondent <span className="surligne">vraiment</span>.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-soft">
                JobBot lit les annonces publiées par les entreprises et les sources officielles,
                puis explique chaque correspondance{" "}
                <strong className="font-medium text-ink">critère par critère</strong> — ce qui
                colle, ce qui manque, et ce que ça veut dire avant de postuler.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/offres?zone=toulouse&tri=score"
                  className="bouton-plein px-5 py-3 text-sm font-medium"
                >
                  Voir les {meta.zones.toulouse} offres à Toulouse
                </Link>
                <Link href="/offres?zone=idf&tri=score" className="bouton-vide px-5 py-3 text-sm font-medium">
                  Île-de-France ({meta.zones.idf})
                </Link>
                <Link href="/methode" className="lien-anime py-3 text-sm font-medium text-accent">
                  Comment ça marche
                </Link>
              </div>
            </div>

            {/* La meilleure offre du jour, en vrai. L'espace à droite montre le produit
                au lieu de rester vide. */}
            {reference ? (
              <div className="relative">
                <div className="card carte-vive p-6">
                  <p className="label">Offre la mieux notée aujourd&apos;hui</p>
                  <h2 className="mt-3 text-lg leading-snug font-medium">
                    {reference.title ?? "Offre"}
                  </h2>
                  <p className="mt-1.5 text-sm text-muted">
                    {reference.company ?? "—"} · {reference.location ?? "lieu non précisé"}
                  </p>
                  <div className="mt-5 flex items-center gap-5 border-t border-line pt-5">
                    <ScoreBadge score={reference.score} taille="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="num text-sm text-ink-soft">
                        {reference.score_breakdown?.length ?? 0} critères détaillés
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Chaque point est justifié sur la fiche.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/offres/${reference.id}`}
                    className="lien-anime mt-5 inline-block text-sm font-medium text-accent"
                  >
                    Voir son bulletin complet
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-t border-line/80 bg-surface/50 px-6 py-10 backdrop-blur-sm sm:px-12 lg:grid-cols-4">
            {[
              { k: "Offres en base", v: meta.count },
              { k: "Toulouse et alentours", v: meta.zones.toulouse },
              { k: "Île-de-France", v: meta.zones.idf },
              { k: "Vues ces 7 derniers jours", v: vues7j },
            ].map((s) => (
              <div key={s.k}>
                <dd className="num font-display text-4xl leading-none tracking-tight">{s.v}</dd>
                <dt className="mt-2 label">{s.k}</dt>
              </div>
            ))}
          </dl>
          <p className="border-t border-line/80 bg-surface/50 px-6 pb-7 text-xs text-muted sm:px-12">
            Chiffres réels, relevés à la dernière collecte du{" "}
            {new Date(meta.generated_at).toLocaleString("fr-FR")}. Aucune donnée de démonstration.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------- meilleures offres */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="compteur">01</p>
            <h2 className="titre-section mt-3">Le haut du classement aujourd&apos;hui</h2>
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
              <p className="compteur">02</p>
              <h2 className="titre-section mt-3 lg:sticky lg:top-24">Une note, neuf raisons</h2>
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
              <p className="label">
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
        <section className="mx-auto max-w-6xl px-5 py-16">
          <p className="compteur">03</p>
          <h2 className="titre-section mt-3">Ce qui revient dans les offres, et pas ton CV</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Compté sur les {offers.length} offres de la collecte, en reprenant les compétences
            explicitement demandées par les annonces. Ces chiffres disent quoi travailler en premier —
            pas une note sur toi.
          </p>
          <div className="card mt-8 p-6 sm:p-8">
            <Barres
              donnees={lacunes.map((l) => ({ label: l.label, valeur: l.n }))}
              total={offers.length}
            />
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------- le simulant */}
      {leviers.length > 0 ? (
        <section className="px-3 sm:px-5">
          <div className="regle bloc mx-auto max-w-[78rem] border border-line px-6 py-16 sm:px-12">
            <p className="compteur">04</p>
            <h2 className="titre-section mt-3">Et si tu apprenais une de ces compétences ?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Chaque ligne est la collecte entière reclassée avec cette compétence en plus, par le
              moteur qui calcule déjà les notes affichées. Aucune estimation, aucun modèle : le même
              calcul, avec une case cochée en plus.
            </p>
            <div className="mt-9 card p-6 sm:p-7">
              <p className="text-sm text-ink-soft">
                Aujourd&apos;hui,{" "}
                <strong className="num font-semibold text-ink">{dejaBonnes} offres</strong> sont
                au-dessus de <span className="num">{SEUIL_BONNE_PISTE}</span> sur{" "}
                <span className="num">{offers.length}</span>. Voilà où chaque compétence
                emmènerait ce chiffre.
              </p>
              <div className="mt-6">
                <Dumbbell
                  legendeAvant="Aujourd'hui"
                  legendeApres="Avec la compétence"
                  donnees={leviers.map(({ competence, effet }) => ({
                    label: competence.label,
                    avant: dejaBonnes,
                    apres: dejaBonnes + effet.franchissent,
                    detail:
                      `${competence.label} — demandée par ${competence.demandee} offres. ` +
                      `${effet.franchissent} franchiraient ${SEUIL_BONNE_PISTE} ; ` +
                      `${effet.montent} notes monteraient, de ${effet.gainMoyen} points en moyenne.`,
                  }))}
                />
              </div>
            </div>

            <p className="mt-5 max-w-2xl text-xs leading-relaxed text-muted">
              Le détail offre par offre est sur chaque fiche : coche la compétence, la note est
              recalculée et le critère qui bouge est nommé.
            </p>
          </div>
        </section>
      ) : null}

      {/* -------------------------------------------------------- différenciateurs */}
      <section className="border-t border-line bg-paper-deep/50">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <p className="compteur">05</p>
          <h2 className="titre-section mt-3">Ce que les outils américains ne peuvent pas faire</h2>
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
            <p className="label">Sans compte</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Toutes les offres, triées par date, avec la source et la date de collecte. Le lien vers
              l&apos;annonce d&apos;origine est toujours là.
            </p>
          </div>
          <div className="card p-6">
            <p className="label">Avec un compte</p>
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
