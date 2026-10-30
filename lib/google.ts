/**
 * Rendre à Google l'autorisation qu'il nous a donnée.
 *
 * Supprimer un compte effaçait nos lignes et s'arrêtait là. Mais l'autorisation, elle, vit chez
 * Google : JobBot restait inscrit dans les applications autorisées du compte. Conséquence visible,
 * et c'est ce qui a fait découvrir le défaut — après « supprimer mon compte », se reconnecter ne
 * demandait plus rien. Google sautait l'écran de consentement et renvoyait aussitôt, ce qui
 * recréait un compte neuf en un clic. L'effacement avait l'air d'un effacement et n'en était pas
 * tout à fait un : il restait, ailleurs, une trace disant que cette personne nous avait dit oui.
 *
 * Révoquer le jeton de rafraîchissement annule aussi les jetons d'accès qui en dérivent. Après
 * quoi la reconnexion repasse par le consentement, comme la première fois.
 *
 * Cette opération est **au mieux**. Si Google est injoignable, la suppression doit quand même
 * avoir lieu : refuser d'effacer les données de quelqu'un parce qu'un tiers ne répond pas serait
 * le pire des deux mondes. L'échec est donc signalé, jamais propagé.
 */
import { base } from "./db";

/** Ce que Google a répondu, dans une forme qu'on peut journaliser sans rien révéler. */
export type Revocation =
  | { etat: "revoque" }
  /** Aucun jeton en base : compte lié sans jeton conservé, ou déjà révoqué. */
  | { etat: "rien-a-revoquer" }
  | { etat: "refus"; code: number }
  | { etat: "injoignable"; cause: string };

/**
 * Révoque l'autorisation Google de cette personne.
 *
 * À appeler **avant** la suppression de la ligne `users` : la cascade emporte `accounts`, donc
 * les jetons avec, et il ne resterait plus rien à révoquer.
 */
export async function revoquerAccesGoogle(userId: string): Promise<Revocation> {
  let jeton: string | null = null;

  try {
    const { rows } = await base().query<{ refresh_token: string | null; access_token: string | null }>(
      `select refresh_token, access_token from accounts
        where "userId" = $1 and provider = 'google'
        limit 1`,
      [userId],
    );
    // Le jeton de rafraîchissement d'abord : le révoquer invalide toute la famille de jetons
    // qui en descend, là où révoquer un jeton d'accès ne coupe que celui-là.
    jeton = rows[0]?.refresh_token ?? rows[0]?.access_token ?? null;
  } catch (e) {
    return { etat: "injoignable", cause: e instanceof Error ? e.name : "lecture impossible" };
  }

  if (!jeton) return { etat: "rien-a-revoquer" };

  try {
    const r = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: jeton }),
    });
    // 200 : c'est fait. 400 : Google ne connaît plus ce jeton — déjà expiré ou déjà révoqué,
    // ce qui est le résultat voulu, donc on ne le compte pas comme un échec.
    if (r.ok || r.status === 400) return { etat: "revoque" };
    return { etat: "refus", code: r.status };
  } catch (e) {
    return { etat: "injoignable", cause: e instanceof Error ? e.name : "réseau" };
  }
}
