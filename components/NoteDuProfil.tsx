import Link from "next/link";
import { Bulletin } from "@/components/Bulletin";
import { ScoreBadge } from "@/components/ScoreBadge";
import { ZONE_LABEL } from "@/lib/offers";
import { NIVEAU_LABEL, RECHERCHE_LABEL, classementPour, estVide, lireProfil } from "@/lib/profil";

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

  const zones = profil.zones.length
    ? profil.zones.map((z) => ZONE_LABEL[z]).join(", ")
    : "toutes zones";
  const resume = `${NIVEAU_LABEL[profil.niveau]} · ${profil.recherche
    .map((r) => RECHERCHE_LABEL[r].toLowerCase())
    .join(" et ")} · ${zones}`;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="label">Note pour ton profil</p>
          <p className="mt-1 text-sm text-ink-soft">{resume}</p>
        </div>
        <ScoreBadge score={resultat?.total ?? null} taille="lg" />
      </div>

      <div className="mt-6">
        <Bulletin breakdown={resultat?.breakdown ?? null} />
      </div>

      <p className="mt-4 text-xs text-muted">
        Calculée à partir de tes {profil.competences.length} compétences confirmées.{" "}
        <Link href="/profil" className="lien-anime text-accent">
          Modifier le profil
        </Link>
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
