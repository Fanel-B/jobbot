import { Suspense } from "react";
import Link from "next/link";
import {
  CarteOuverture,
  CarteOuvertureSquelette,
  SectionsProfil,
  SectionsProfilSquelette,
} from "@/components/AccueilProfil";
import {
  ageJours,
  meta,
  nbSignalFormation,
  offers,
  offresAvecContrat,
  offresSansContrat,
  sourceLabel,
} from "@/lib/offers";

export default function Home() {
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

  const sources = Object.entries(meta.sources).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      {/* ------------------------------------------------------------ ouverture */}
      {/* Un grand bloc arrondi posé sur le papier, sur la trame d'un cahier de notes. */}
      <section className="px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="regle bloc mx-auto max-w-[78rem] overflow-hidden border border-line">
          <div className="cascade grid gap-12 px-6 py-16 sm:px-12 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:py-20">
            <div>
              <p className="label">Stages et alternances · Toulouse et Île-de-France</p>
              <h1 className="titre-geant mt-5 max-w-[11ch]">
                Les offres qui te correspondent <em className="italique-accent">vraiment</em>.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-soft">
                <span className="num">{meta.count}</span> annonces réelles, relevées chez les
                entreprises et les sources officielles. Pour chacune, sa note{" "}
                <strong className="font-medium text-ink">critère par critère</strong> : ce qui
                colle, et ce qui manque.
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

            {/* La carte dépend du profil : elle arrive en flux, le reste de l'ouverture
                est pré-rendu. */}
            <Suspense fallback={<CarteOuvertureSquelette />}>
              <CarteOuverture />
            </Suspense>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-t border-line/80 bg-surface/50 px-6 py-10 backdrop-blur-sm sm:px-12 lg:grid-cols-4">
            {[
              { k: "Offres en base", v: meta.count },
              { k: "Toulouse et alentours", v: meta.zones.toulouse },
              { k: "Île-de-France", v: meta.zones.idf },
              { k: "Vues ces 7 derniers jours", v: vues7j },
            ].map((s) => (
              // Le micro-label au-dessus du nombre, pas en dessous : on lit d'abord de quoi
              // il s'agit, puis combien. Posé après coup, le chiffre arrive sans sujet.
              <div key={s.k}>
                <dt className="label">{s.k}</dt>
                <dd className="chiffre mt-2">{s.v}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-line/80 bg-surface/50 px-6 pb-7 text-xs text-muted sm:px-12">
            Chiffres réels, relevés à la dernière collecte du{" "}
            {new Date(meta.generated_at).toLocaleString("fr-FR")}. Aucune donnée de démonstration.
          </p>
        </div>
      </section>

      {/* --------------------------------- ce qui dépend du profil (01 à 04) */}
      <Suspense fallback={<SectionsProfilSquelette />}>
        <SectionsProfil />
      </Suspense>

      {/* -------------------------------------------------------- différenciateurs */}
      <section className="border-t border-line bg-paper-deep/50">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <h2 className="titre-section">Ce que les outils américains ne peuvent pas faire</h2>
          {/* Trois lignes, pas trois cartes identiques. La rangée de cartes jumelles est la
              mise en page la plus reconnaissable des pages faites à la chaîne ; ici chaque point
              se lit comme l'entrée d'un document, avec son titre à gauche et son texte à droite. */}
          <dl className="mt-10 divide-y divide-line border-y border-line">
            {[
              {
                t: "Le signal « formation imposée »",
                d: `Un stage publié par un organisme de formation qui impose son école relève du sourcing. JobBot le repère et le dit, toujours en citant l'extrait qui a déclenché le signal. ${texteFormation}`,
              },
              {
                t: "Les règles françaises d'éligibilité",
                d: "Durée minimale, date de début, niveau requis : ce sont les conventions françaises qui décident, et non un score générique importé d'un autre marché.",
              },
              {
                t: "Les sources officielles",
                d: "La Bonne Alternance et France Travail ont des interfaces publiques et gratuites. Teal et Jobscan, eux, s'arrêtent aux annonces anglo-saxonnes.",
              },
            ].map((b) => (
              <div
                key={b.t}
                className="grid gap-x-10 gap-y-2 py-6 sm:grid-cols-[16rem_1fr] sm:py-7"
              >
                <dt className="text-[15px] font-medium leading-snug">{b.t}</dt>
                <dd className="max-w-2xl text-sm leading-relaxed text-muted">{b.d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------------ honnêteté */}
      <section className="mx-auto max-w-6xl px-5 py-24">
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
              correspond : le détail de la note, les compétences qui manquent, et la version de CV à
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
