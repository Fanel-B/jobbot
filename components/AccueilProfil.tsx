import Link from "next/link";
import { Bulletin } from "@/components/Bulletin";
import { ScoreBadge } from "@/components/ScoreBadge";
import { OfferMini } from "@/components/OfferCard";
import { Barres, Dumbbell } from "@/components/Graphes";
import { critereLabel, enLettres, lacunesRegroupees, meta, structureBulletin } from "@/lib/offers";
import { SEUIL_BONNE_PISTE, volumeSuffisant } from "@/lib/simulation";
import {
  competencesSimulablesPour,
  effetGlobalPour,
  estParDefaut,
  lireProfil,
  offresAuDessusPour,
  offresPour,
} from "@/lib/profil";

/**
 * Les parties de l'accueil qui dépendent du profil.
 *
 * Tout ce qui est ici se calcule à la lecture, pour la personne qui regarde : le haut du
 * classement, son bulletin d'exemple, ce qui lui manque, et ce que chaque compétence lui
 * rapporterait. Le reste de la page — la promesse, les chiffres de la collecte, les sources —
 * ne dépend de personne et reste pré-rendu.
 *
 * Avant, ces quatre sections tournaient sur le profil d'usine pendant que la liste et les
 * fiches suivaient le profil réel : l'accueil annonçait « et pas ton CV » en comptant sur le CV
 * de quelqu'un d'autre.
 */
async function donnees() {
  const profil = await lireProfil();
  const notees = offresPour(profil);
  const avecContrat = notees.filter((o) => o.contract_known);
  const meilleures = [...avecContrat].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 6);
  return { profil, notees, meilleures, reference: meilleures[0] };
}

/** La carte d'offre de l'ouverture : la mieux notée **pour ce profil**. */
export async function CarteOuverture() {
  const { reference } = await donnees();
  return (
    <>
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
            {/* En colonne sur un téléphone : la note porte son libellé en toutes
                lettres, donc côte à côte elle écrase le texte voisin jusqu'à le
                rendre vertical. Constaté à 360 px. */}
            <div className="mt-5 flex flex-col items-start gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:gap-5">
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
    </>
  );
}

export function CarteOuvertureSquelette() {
  return (
    <div className="card p-6" aria-hidden>
      <div className="h-3 w-44 rounded bg-paper-deep" />
      <div className="mt-4 h-5 w-full rounded bg-paper-deep/70" />
      <div className="mt-2 h-5 w-2/3 rounded bg-paper-deep/70" />
      <div className="mt-6 h-20 rounded-card bg-paper-deep/50" />
    </div>
  );
}

/** Les quatre sections de l'accueil qui dépendent du profil. */
export async function SectionsProfil() {
  const { profil, notees, meilleures, reference } = await donnees();
  const offers = notees;
  const lacunes = lacunesRegroupees(notees, 8);
  const dejaBonnes = offresAuDessusPour(profil);
  const leviers = volumeSuffisant()
    ? competencesSimulablesPour(profil, 4)
        .map((c) => ({ competence: c, effet: effetGlobalPour(profil, c) }))
        .filter((l) => l.effet.franchissent > 0 || l.effet.montent > 0)
        .sort((a, b) => b.effet.franchissent - a.effet.franchissent || b.effet.montent - a.effet.montent)
    : [];

  return (
    <>
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
          <h2 className="titre-section mt-3 lg:sticky lg:top-24">
                Une note, {enLettres(structureBulletin.notes.length)} raisons
              </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
            La note n&apos;est pas une impression : elle additionne{" "}
            {enLettres(structureBulletin.notes.length)} critères calculés par du
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
    </>
  );
}

export function SectionsProfilSquelette() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14" aria-hidden>
      <div className="h-3 w-10 rounded bg-paper-deep" />
      <div className="mt-4 h-9 w-96 max-w-full rounded bg-paper-deep" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-card bg-paper-deep/60" />
        ))}
      </div>
    </div>
  );
}
