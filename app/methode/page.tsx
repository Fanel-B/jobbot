import Link from "next/link";
import { critereLabel, enLettres, meta, nbSignalFormation, offers, sourceLabel } from "@/lib/offers";
import { estConstant } from "@/lib/groupes";
import { chiffresMethode, type GroupeMethode } from "@/lib/methode";

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

/** Un groupe du relevé : son titre, son barème, ses critères et ses ajustements. */
function BlocGroupe({ titre, intro, g }: { titre: string; intro: string; g: GroupeMethode }) {
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-[15px] font-medium text-ink">{titre}</h4>
        <span className="font-mono text-xs tabular-nums text-muted">
          sur <span className="num text-ink">{g.max}</span>
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{intro}</p>

      <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
        {g.criteres.map((c) => (
          <li key={c.critere} className="flex items-baseline justify-between gap-3 py-2">
            <span className={estConstant(c.critere) ? "text-muted" : "text-ink-soft"}>
              {critereLabel(c.critere)}
              {estConstant(c.critere) ? (
                <span className="text-xs italic"> · ne départage aucune offre</span>
              ) : null}
            </span>
            <span className="font-mono tabular-nums text-muted">{c.max}</span>
          </li>
        ))}
      </ul>

      {g.ajustements.length > 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Ajustements, sans barème :{" "}
          {g.ajustements.map((c) => critereLabel(c).toLowerCase()).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

export default function Page() {
  const sources = Object.entries(meta.sources).sort((a, b) => b[1] - a[1]);
  const nbFormation = nbSignalFormation(offers);
  // Les chiffres de la note se déduisent du moteur et de l'export, ils ne sont pas écrits en
  // dur : une phrase figée devient fausse sans que personne ne le voie. `lib/methode.test.ts`
  // épingle ce que la page cite et que le moteur garde en constantes privées.
  const m = chiffresMethode();
  const nbAjustements = m.toi.ajustements.length + m.annonce.ajustements.length;
  const diversite = m.constants.find((c) => c.critere === "diversité");
  const dossier = m.constants.find((c) => c.critere === "dossier");
  const coherence = m.toi.criteres.find((c) => c.critere === "cohérence");

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
          Collecte du {new Date(meta.generated_at).toLocaleString("fr-FR")}, {meta.count} offres en
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
              dit, jamais on ne s&apos;acharne.
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
          La note est calculée par du <strong className="font-medium">code déterministe</strong>,
          pas par un modèle de langage. Deux personnes avec le même profil obtiennent exactement la
          même note, et n&apos;importe qui peut refaire le calcul à la main : sur chaque fiche, le
          total est la somme exacte des lignes du relevé.
        </p>

        <h3 className="mt-10 font-display text-2xl font-light leading-tight text-ink">
          Un relevé en deux groupes
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Le relevé d&apos;une fiche se lit comme un bulletin scolaire : des matières rangées en
          deux groupes, un sous-total pour chacun, puis le total sur{" "}
          <span className="num">{m.total}</span>. Les deux sous-totaux s&apos;additionnent, sans
          coefficient caché ni arrondi de faveur.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <BlocGroupe
            titre="Toi, face à cette offre"
            intro="Ce qui compare l'annonce à un candidat."
            g={m.toi}
          />
          <BlocGroupe
            titre="L'annonce elle-même"
            intro="Sa fraîcheur, sa source, ce qu'elle dit. Identique pour tout le monde."
            g={m.annonce}
          />
        </div>

        <h3 className="mt-10 font-display text-2xl font-light leading-tight text-ink">
          Ce qui suit ton profil, et ce qui ne le suit pas encore
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Une seule ligne lit ce que tu as confirmé : la{" "}
          <strong className="font-medium">cohérence</strong>
          {coherence ? (
            <>
              , <span className="num">{coherence.max}</span> points,
            </>
          ) : null}{" "}
          qui compte combien des technologies citées par l&apos;annonce figurent dans tes
          compétences cochées. C&apos;est la seule partie de la note qui change d&apos;une personne
          à l&apos;autre.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Les autres lignes du groupe « toi » comparent l&apos;annonce à une situation fixe, celle de
          Fanel, l&apos;auteur du site : un niveau Bac+3, disponible à partir du 29 mars 2027, avec
          un stage à finir avant la rentrée de Master de septembre 2027 (une fin au 31 juillet 2027
          au plus tard est jugée compatible). Le niveau, la zone et le type de recherche que tu
          règles sur la page profil ne changent donc pas la note pour l&apos;instant.
        </p>

        <h3 className="mt-10 font-display text-2xl font-light leading-tight text-ink">
          Les ajustements
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Aux critères notés s&apos;ajoutent {enLettres(nbAjustements)} lignes d&apos;
          <strong className="font-medium">ajustement</strong>, sans barème : elles ajoutent ou
          retirent des points après coup. Un niveau de diplôme hors de portée en retire ; un
          bloqueur administratif, comme une habilitation de sécurité, plafonne la note à 55.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Un sous-total peut donc être négatif quand les ajustements retirent plus que le groupe ne
          rapporte. Le relevé affiche alors le chiffre vrai, avec ce qui a été gagné et ce qui a été
          retiré, plutôt qu&apos;un zéro qui ne serait plus la somme de ses lignes.
        </p>

        <h3 className="mt-10 font-display text-2xl font-light leading-tight text-ink">
          Le rang avant la note
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Les offres sont classées sur le sous-total « toi », jamais sur le total. Le groupe
          « l&apos;annonce » pèse <span className="num">{m.annonce.max}</span> points sur{" "}
          <span className="num">{m.total}</span> et vaut pareil pour tout le monde : classer sur le
          total annoncerait « 11e meilleure correspondance » pour ce qui est en réalité la 11e
          meilleure annonce. À sous-total égal, la note de l&apos;annonce départage.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Le rang s&apos;écrit parmi les <span className="num">{m.notables}</span> annonces que
          l&apos;on peut noter (« 11e sur {m.notables} ») et passe devant la note : une place se
          comprend et se vise, un pourcentage nu se subit.
        </p>

        <h3 className="mt-10 font-display text-2xl font-light leading-tight text-ink">
          Deux lignes qui ne départagent rien
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Deux lignes valent la même chose sur toutes les annonces de la collecte : la{" "}
          <strong className="font-medium">diversité des candidatures</strong>,{" "}
          <span className="num">{diversite?.points}</span> sur{" "}
          <span className="num">{diversite?.max}</span> partout, et le{" "}
          <strong className="font-medium">dossier déjà prêt</strong>,{" "}
          <span className="num">{dossier?.points}</span> sur{" "}
          <span className="num">{dossier?.max}</span> partout. Elles s&apos;affichent en gris, avec
          la mention « ne départage aucune offre ».
        </p>
        {/* Le plafond par groupe a été retiré le 21/10/2026. Le critère reste au bulletin, parce
            que l'en retirer casserait la promesse que le total est la somme de ses lignes, et son
            détail reste informatif (le rang chez l'employeur). Le dire évite qu'on se demande
            pourquoi cette ligne est pleine partout. */}
        <p className="mt-3 text-sm leading-relaxed text-muted">
          La diversité comptait le rang d&apos;une offre parmi celles d&apos;un même employeur et
          retirait des points au-delà de la troisième. Ce plafond a été retiré le 21 octobre 2026 :
          la ligne affiche donc son maximum partout, et son détail dit toujours le rang. Le dossier
          lit les démarches que tu aurais enregistrées sur le site, et le site n&apos;en enregistre
          encore aucune.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Elles restent comprises dans le total : les en retirer ferait afficher au site une note
          différente de celle que calcule le moteur de référence, et l&apos;accord entre les deux
          est ce qui fait la valeur du projet.
        </p>

        <h3 className="mt-10 font-display text-2xl font-light leading-tight text-ink">
          Les annonces qu&apos;on ne peut pas noter
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          <span className="num">{m.incalculables}</span> annonces sur{" "}
          <span className="num">{m.collecte}</span> ne citent aucune technologie reconnue. Pour
          elles, la correspondance avec ton profil n&apos;est pas faible : elle est{" "}
          <strong className="font-medium">incalculable</strong>, et lui donner des points par
          défaut reviendrait à prétendre avoir vérifié ce qui ne l&apos;a pas été.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Elles sortent donc du classement et s&apos;affichent dans un bloc à part, sous la liste,
          avec cette explication. Le classement porte sur les{" "}
          <span className="num">{m.notables}</span> autres.
        </p>

        <h3 className="mt-10 font-display text-2xl font-light leading-tight text-ink">
          La fraîcheur : un signal, pas une note
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Une annonce publiée il y a plus de <span className="num">{m.seuilAge}</span> jours porte
          une mention : « vérifie qu&apos;elle est encore ouverte ». À la dernière collecte,{" "}
          <span className="num">{m.nbAgees}</span> annonces sont dans ce cas.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          La mention ne retire aucun point et ne change pas le classement : l&apos;âge dit si
          l&apos;annonce a des chances d&apos;exister encore, pas si elle te correspond. La ligne
          « fraîcheur » du relevé existe toujours, dans le groupe « l&apos;annonce », mais elle
          n&apos;entre pas dans le rang.
        </p>

        <p className="mt-10 text-sm leading-relaxed text-muted">
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
          <li>
            Noter une annonce dont on ne peut pas mesurer la correspondance : elle est signalée
            incalculable, pas notée faible.
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
