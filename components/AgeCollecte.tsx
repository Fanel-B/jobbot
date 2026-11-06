import { connection } from "next/server";
import { mentionCollecteAncienne } from "@/lib/collecte";

/**
 * La mise en garde « plus de 24 heures », calculée à chaque requête.
 *
 * `connection()` arrête le pré-rendu avant la lecture de l'horloge : sans lui, l'âge serait figé
 * au moment du build (et `cacheComponents` refuse d'ailleurs une heure lue au pré-rendu). La
 * date de collecte, elle, reste dans la partie pré-rendue du pied de page : seule cette ligne
 * attend la requête. À placer sous un `<Suspense>`.
 */
export async function AgeCollecte({ generatedAt }: { generatedAt: string }) {
  await connection();
  const mention = mentionCollecteAncienne(generatedAt, Date.now());
  if (!mention) return null;
  return <li className="text-warn">{mention}</li>;
}
