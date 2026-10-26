import Link from "next/link";
import type { Metadata } from "next";
import { meta } from "@/lib/offers";

export const metadata: Metadata = {
  title: "Données et mentions légales — JobBot",
  description:
    "Ce que JobBot stocke, où, pourquoi, et comment l'effacer. Éditeur, hébergeur et sources des offres.",
};

/**
 * Données personnelles et mentions légales.
 *
 * Écrite pour être exacte au jour où elle est lue, pas pour cocher une case : chaque phrase
 * décrit ce que le code fait réellement aujourd'hui. Le cahier de route l'exige dès qu'une
 * personne autre que Fanel utilise le site — « ce qui est stocké, pourquoi, et que l'IA lit le
 * CV » — et la règle du projet interdit d'annoncer ce qui n'existe pas.
 *
 * À reprendre le jour où les comptes arrivent : il y aura alors un hébergement de données chez
 * un tiers, et cette page devra le dire.
 */
export default function Page() {
  const collecte = new Date(meta.generated_at).toLocaleDateString("fr-FR");

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="compteur">Données</p>
      <h1 className="titre-page mt-3">Ce que ce site sait de toi</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        Réponse courte : <strong className="font-medium text-ink">presque rien</strong>, et rien
        qui sorte de ton navigateur. Le détail suit, et il décrit ce que le code fait aujourd&apos;hui
        — pas ce qui est prévu.
      </p>

      <section className="mt-12">
        <h2 className="titre-section">Ce qui est stocké</h2>

        <dl className="mt-6 divide-y divide-line border-y border-line">
          <div className="grid gap-x-10 gap-y-2 py-5 sm:grid-cols-[12rem_1fr]">
            <dt className="text-[15px] font-medium">Ton profil</dt>
            <dd className="text-sm leading-relaxed text-muted">
              Les compétences que tu as cochées sur <Link href="/profil" className="lien-anime text-accent">/profil</Link>,
              ta zone, ton niveau et le type de contrat recherché. Ils vivent dans un{" "}
              <strong className="font-medium text-ink-soft">cookie sur ton navigateur</strong>,
              en clair et lisible. Ils ne sont envoyés à aucun serveur et ne sont associés à aucun
              compte — il n&apos;y a pas de compte.
            </dd>
          </div>

          <div className="grid gap-x-10 gap-y-2 py-5 sm:grid-cols-[12rem_1fr]">
            <dt className="text-[15px] font-medium">Rien d&apos;autre</dt>
            <dd className="text-sm leading-relaxed text-muted">
              Pas de nom, pas d&apos;adresse e-mail, pas de CV. Aucun traceur publicitaire, aucun
              outil de mesure d&apos;audience, aucun partage avec un tiers.
            </dd>
          </div>

          <div className="grid gap-x-10 gap-y-2 py-5 sm:grid-cols-[12rem_1fr]">
            <dt className="text-[15px] font-medium">L&apos;hébergeur</dt>
            <dd className="text-sm leading-relaxed text-muted">
              Le site est hébergé par <strong className="font-medium text-ink-soft">Vercel</strong>,
              qui conserve des journaux techniques (adresse IP, page demandée, horodatage) pour
              faire fonctionner et protéger le service. Je n&apos;y ai pas accès nominativement et
              je ne m&apos;en sers pas.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="titre-section">Comment l&apos;effacer</h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Le bouton <strong className="font-medium">« Effacer mon profil »</strong>, en bas de la
          page <Link href="/profil" className="lien-anime text-accent">/profil</Link>, supprime le
          cookie pour de bon. Vider les données du site dans ton navigateur fait la même chose.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Comme rien n&apos;est stocké ailleurs, il n&apos;y a pas de demande à m&apos;adresser ni
          de délai à attendre : l&apos;effacement est immédiat et complet.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="titre-section">Les offres affichées</h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Les {meta.count} annonces viennent des interfaces publiques des entreprises et des
          sources officielles françaises, relevées le {collecte}. Elles sont publiques et
          reproduites avec, toujours, un lien vers l&apos;annonce d&apos;origine — le site renvoie
          vers l&apos;employeur, il ne se substitue pas à lui.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Aucun site n&apos;est scrapé contre sa volonté, aucune protection n&apos;est contournée.
          Le détail des sources et des règles de collecte est sur{" "}
          <Link href="/methode" className="lien-anime text-accent">la page méthode</Link>.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Si une annonce vous appartient et que vous souhaitez qu&apos;elle n&apos;apparaisse plus,
          écrivez-moi : elle sera retirée.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="titre-section">Quand il y aura des comptes</h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Ce n&apos;est pas encore le cas. Le jour où ça le sera, cette page sera réécrite{" "}
          <strong className="font-medium">avant</strong> que la première inscription soit possible,
          et elle dira ce qui est conservé, où, combien de temps, et comment tout supprimer d&apos;un
          bouton. Un CV déposé serait une donnée personnelle hébergée pour quelqu&apos;un d&apos;autre :
          ça ne se fait pas sans l&apos;écrire d&apos;abord.
        </p>
      </section>

      <section className="mt-12 border-t border-line pt-8">
        <h2 className="label">Mentions légales</h2>
        <dl className="mt-5 grid gap-x-10 gap-y-4 text-sm sm:grid-cols-[12rem_1fr]">
          <dt className="text-muted">Éditeur</dt>
          <dd className="text-ink-soft">
            Fanel Balemo, étudiant en MIAGE à Toulouse. Projet personnel, sans activité
            commerciale, sans publicité et sans monétisation.
          </dd>
          <dt className="text-muted">Responsable</dt>
          <dd className="text-ink-soft">Fanel Balemo</dd>
          <dt className="text-muted">Hébergeur</dt>
          <dd className="text-ink-soft">
            Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com
          </dd>
          <dt className="text-muted">Code source</dt>
          <dd className="text-ink-soft">
            <a
              href="https://github.com/Fanel-B/jobbot"
              target="_blank"
              rel="noopener noreferrer"
              className="lien-anime text-accent"
            >
              github.com/Fanel-B/jobbot
            </a>{" "}
            — ouvert, y compris le calcul de la note.
          </dd>
        </dl>
      </section>

      <p className="mt-12 text-xs leading-relaxed text-muted">
        Cette page décrit l&apos;état du site au jour où vous la lisez. Si quelque chose vous paraît
        inexact, le code est public et la page qui le prouve aussi.
      </p>
    </div>
  );
}
