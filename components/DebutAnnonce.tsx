import { dateDebutNonExploitable, dateLongue } from "@/lib/dates";
import { FIN_DE_STAGE_LA_PLUS_TARDIVE } from "@/lib/scoring";

/**
 * La ligne « Début » d'une fiche.
 *
 * Neuf annonces sur dix ne donnent pas de date de début lisible. Les écrire « non précisée » laissait
 * croire que l'information n'avait aucune suite ; or elle en a une : le stage doit finir avant la
 * rentrée de Master. Quand la date n'est pas exploitable, la ligne le dit, demande de confirmer, et
 * rappelle la fin au plus tard.
 *
 * « Exploitable » est la décision du pipeline (`lib/dates.ts`, vérifiée offre par offre contre
 * `note_date` par `npm run verifier-eligibility`), pas un test sur la forme du texte. La date de fin
 * vient du moteur (`FIN_DE_STAGE_LA_PLUS_TARDIVE`), la même que la page méthode. La règle est
 * expliquée une fois sur `/methode` ; rien ne s'ajoute aux cartes de la liste.
 */
export function DebutAnnonce({ debut }: { debut: string | null }) {
  const texte = (debut ?? "").trim();
  const aConfirmer = dateDebutNonExploitable(debut);

  return (
    <>
      {texte ? (
        texte
      ) : (
        <span className="italic text-muted">non précisée par l&apos;annonce</span>
      )}
      {aConfirmer ? (
        <span className="text-muted">
          {texte ? " (date non exploitable)" : ""}, à confirmer. Fin au plus tard le{" "}
          {dateLongue(FIN_DE_STAGE_LA_PLUS_TARDIVE)}.
        </span>
      ) : null}
    </>
  );
}
