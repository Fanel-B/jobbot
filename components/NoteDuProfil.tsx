import Link from "next/link";
import { Bulletin } from "@/components/Bulletin";
import { ScoreBadge } from "@/components/ScoreBadge";
import { classementPour, estVide, lireProfil } from "@/lib/profil";
import { observationPour, rangDe, rangEnLettres, tranchePour } from "@/lib/classement";

/**
 * La note de cette offre **pour le profil en cours**, avec son bulletin.
 *
 * Elle est recalculée à la lecture, jamais stockée : c'est la décision structurante du cahier de
 * route — deux personnes voient la même offre, pas la même note. Le résumé du profil est affiché
 * juste au-dessus, pour qu'on sache toujours à qui appartient le chiffre.
 */
export async function NoteDuProfil({ offreId }: { offreId: number }) {
  const profil = await lireProfil();

  // Pas de profil, pas de note. Afficher un bulletin calculé sur zéro compétence donnerait une
  // page entière de lignes à zéro, exacte et incompréhensible : on dirait que l'offre est
  // mauvaise alors qu'on ne sait simplement rien de la personne.
  if (estVide(profil)) {
    return (
      <div>
        <p className="label">Cette offre te correspond-elle ?</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Dis ce que tu sais faire et cette offre reçoit sa note, détaillée critère par critère :
          ce qui colle, ce qui manque, et ce que ça change.
        </p>
        <Link
          href="/profil"
          className="bouton-plein mt-5 inline-flex px-5 py-3 text-sm font-medium"
        >
          Dire ce que je sais faire
        </Link>
        <p className="mt-4 text-xs text-muted">
          Une minute, rien à créer, et la note se recalcule à chaque visite plutôt que d&apos;être
          stockée.
        </p>
      </div>
    );
  }

  const resultat = classementPour(profil).get(offreId);
  const place = rangDe(profil, offreId);
  const observation = observationPour(profil, offreId);

  return (
    <>
      {/* L'en-tête d'un relevé nomme toujours qui est noté avant d'annoncer la note. Sans ça,
          le chiffre a l'air d'une propriété de l'offre et non d'une rencontre entre deux choses. */}
      {place ? (
        <div className="mb-5 border-b border-line pb-4">
          <p className="text-sm text-ink-soft">
            <strong className="font-display text-xl font-light text-ink">
              {rangEnLettres(place)}
            </strong>{" "}
            parmi les offres que l&apos;on peut te noter
            {tranchePour(place) ? `, ${tranchePour(place)}` : ""}.
          </p>
        </div>
      ) : (
        <div className="mb-5 border-b border-line pb-4">
          <p className="text-sm leading-relaxed text-ink-soft">
            Cette annonce ne cite aucune technologie reconnaissable : la correspondance avec ton
            profil est <strong className="font-medium text-ink">incalculable</strong>, pas faible.
            Le relevé ci-dessous ne note donc que l&apos;annonce elle-même.
          </p>
        </div>
      )}

      <div className="flex items-start justify-between gap-4 border-b border-line-strong pb-4">
        <div className="min-w-0">
          <p className="label">Relevé de correspondance</p>
          {/* Seules les compétences sont rappelées ici, parce que seules elles entrent dans le
              calcul : le moteur ne reçoit rien d'autre du profil. Cet en-tête affichait avant
              « Bac+5, M2 · stage · Toulouse », comme si la note était calculée pour ce niveau,
              cette zone et ce type de recherche. Elle ne l'était pas. Ces réglages restent
              enregistrés sur la page profil, mais rien ne les lit encore. `lib/entete.test.ts`
              échoue si quelqu'un les réaffiche ici sans les brancher sur le moteur. */}
          <p className="mt-1.5 text-sm text-ink-soft">
            <span className="num">{profil.competences.length}</span> compétences confirmées
          </p>
        </div>
        <ScoreBadge score={resultat?.total ?? null} taille="lg" />
      </div>

      <div className="mt-5">
        <Bulletin breakdown={resultat?.breakdown ?? null} />
      </div>

      {observation ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="label">Observation</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Il te manque{" "}
            <strong className="font-medium text-ink">{observation.manquants.join(", ")}</strong>{" "}
            sur cette offre.
            {observation.levier ? (
              <>
                {" "}
                Cocher{" "}
                <strong className="font-medium text-ink">{observation.levier.label}</strong> ferait
                monter <span className="num">{observation.levier.montent}</span> offres de la
                collecte
                {observation.levier.franchissent > 0 ? (
                  <>
                    , dont <span className="num">{observation.levier.franchissent}</span> au-dessus
                    du seuil
                  </>
                ) : null}
                .
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-muted">
        <Link href="/profil" className="lien-anime text-accent">
          Modifier le profil
        </Link>{" "}
        et le relevé se recalcule.
      </p>
    </>
  );
}

export function NoteSquelette() {
  return (
    <div aria-hidden>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-3 w-28 rounded bg-paper-deep" />
          <div className="h-4 w-44 rounded bg-paper-deep/70" />
        </div>
        <div className="h-14 w-16 rounded-xl bg-paper-deep" />
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-5 rounded bg-paper-deep/60" />
        ))}
      </div>
    </div>
  );
}
