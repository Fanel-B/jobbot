import Link from "next/link";
import { meta, nbSignalFormation, offers, sourceLabel } from "@/lib/offers";

const SOURCES_DETAIL: Record<string, string> = {
  "sopra-steria": "Site carrière de l'entreprise (interface publique de recrutement).",
  airbus: "Interface Workday publique d'Airbus.",
  thales: "Interface Workday publique de Thales.",
  sii: "Sitemap déclaré du site carrière du Groupe SII.",
  atos: "Sitemap déclaré du site carrière Atos.",
  capgemini: "Interface publique de recrutement Capgemini.",
  cnes: "Sitemap déclaré du site carrière du CNES.",
  linkedin:
    "Alertes e-mail que Fanel a lui-même créées sur son compte LinkedIn, lues dans sa boîte. Aucun scraping.",
  labonnealternance: "Interface publique La Bonne Alternance.",
  france_travail: "Interface publique France Travail (offres d'emploi et de stage).",
};

export default function Page() {
  const sources = Object.entries(meta.sources).sort((a, b) => b[1] - a[1]);
  const nbFormation = nbSignalFormation(offers);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="titre-page">Méthode</h1>
      <p className="mt-4 text-base leading-relaxed text-ink-soft">
        JobBot n&apos;a rien d&apos;une boîte noire : voici d&apos;où viennent les offres, comment la
        note est fabriquée, et ce que le site refuse de faire.
      </p>

      <section className="mt-12">
        <h2 className="titre-section">D&apos;où viennent les offres</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Collecte du {new Date(meta.generated_at).toLocaleString("fr-FR")} — {meta.count} offres en
          base. Toutes proviennent d&apos;interfaces publiques ou d&apos;alertes que l&apos;utilisateur
          a lui-même créées.
        </p>
        <ul className="mt-6 space-y-4">
          {sources.map(([slug, n]) => (
            <li key={slug} className="border-b border-line pb-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-medium">{sourceLabel(slug)}</span>
                <span className="num text-xs text-muted">{n} offres</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {SOURCES_DETAIL[slug] ?? "Source publique."}
              </p>
            </li>
          ))}
        </ul>
        {meta.sources.labonnealternance === undefined &&
        meta.sources.france_travail === undefined ? (
          <p className="mt-5 rounded-card border border-line bg-paper-deep/50 p-4 text-sm text-muted">
            Les interfaces publiques La Bonne Alternance et France Travail sont interrogées à chaque
            collecte : elles ne retournent aujourd&apos;hui aucune offre de stage éligible pour cette
            zone, elles n&apos;apparaissent donc pas dans le décompte.
          </p>
        ) : null}
      </section>

      <section className="mt-12">
        <h2 className="titre-section">Nos règles de collecte</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-soft">
          <li className="flex gap-3">
            <span className="text-good" aria-hidden>
              ✓
            </span>
            <span>
              <strong className="font-medium">robots.txt d&apos;abord.</strong> Un site
              l&apos;interdit, on ne le lit pas. Les sitemaps sont utilisés quand ils sont déclarés, et
              les délais de politesse entre requêtes sont respectés.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-good" aria-hidden>
              ✓
            </span>
            <span>
              <strong className="font-medium">Interfaces officielles quand il y en a.</strong> Mieux
              vaut une API publique qu&apos;une page devinée : c&apos;est plus fiable et plus honnête.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-bad" aria-hidden>
              ✕
            </span>
            <span>
              <strong className="font-medium">Aucun contournement.</strong> Ni protection anti-robot
              forcée, ni CAPTCHA cassé, ni compte emprunté. Quand un portail bloque, on passe et on le
              dit — jamais on ne s&apos;acharne.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-good" aria-hidden>
              ✓
            </span>
            <span>
              <strong className="font-medium">Fenêtre glissante, jamais de fantômes.</strong> Une
              offre disparue de la source est retirée du site : seules les annonces revues récemment
              restent affichées.
            </span>
          </li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="titre-section">Comment la note est fabriquée</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          La note est calculée par du <strong className="font-medium">code déterministe</strong>, pas
          par un modèle de langage. Neuf critères, chacun avec un maximum de points, additionnés sur
          100. Deux personnes avec le même profil obtiennent donc exactement la même note, et
          n&apos;importe qui peut refaire le calcul à la main.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Les critères : cohérence avec le profil, métier visé, qualité de la source, complétude de la
          fiche, compatibilité du calendrier, coût du dépôt (longueur du formulaire), pièces déjà
          prêtes, diversité des candidatures, fraîcheur de l&apos;annonce.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Ce que la note ne prend pas en compte, faute de pouvoir le mesurer honnêtement : la
          rémunération, le temps de trajet, la concurrence sur le poste et le « potentiel
          d&apos;entretien ». Ces critères sont écartés plutôt qu&apos;estimés au doigt mouillé.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="titre-section">Ce que le site refuse de faire</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-soft">
          <li>Inventer une donnée absente : on écrit « non précisé ».</li>
          <li>
            Deviner un type de contrat : une annonce sans contrat affiché porte
            «{" "}
            <em>Type de contrat non renseigné</em> » et sort du classement principal.
          </li>
          <li>Ajouter une compétence à ton CV parce qu&apos;une offre la demande.</li>
          <li>
            Accuser une entreprise : le signal « formation imposée » n&apos;est affiché que
            lorsqu&apos;il peut citer l&apos;extrait qui l&apos;a déclenché. Sans extrait, pas de
            signal.{" "}
            {nbFormation === 0
              ? `Aucune des ${meta.count} annonces de cette collecte ne le déclenche.`
              : `${nbFormation} annonce(s) le déclenchent dans cette collecte.`}
          </li>
          <li>Te faire croire qu&apos;un compte donne accès à de meilleures offres.</li>
        </ul>
      </section>

      <div className="mt-14 flex flex-wrap gap-3 border-t border-line pt-8">
        <Link
          href="/offres"
          className="rounded-lg bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft"
        >
          Explorer les {meta.count} offres
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-line-strong bg-surface px-5 py-3 text-sm font-medium transition hover:border-ink/30"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
