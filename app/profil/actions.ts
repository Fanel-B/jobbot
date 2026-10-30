"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { base } from "@/lib/db";
import { revoquerAccesGoogle } from "@/lib/google";
import { CATALOGUE } from "@/lib/scoring";
import {
  COOKIE_PROFIL,
  PROFIL_DEFAUT,
  encoderProfil,
  type NiveauEtudes,
  type Profil,
  type TypeRecherche,
} from "@/lib/profil";
import type { Zone } from "@/lib/offers";

const ZONES: Zone[] = ["toulouse", "idf", "remote", "autre"];
const NIVEAUX: NiveauEtudes[] = ["bac+3", "bac+4", "bac+5"];
const RECHERCHES: TypeRecherche[] = ["stage", "alternance"];

/** Un an : le profil n'a pas à être redemandé à chaque visite, et il ne contient rien de secret. */
const UN_AN = 60 * 60 * 24 * 365;

/**
 * Enregistre le profil coché.
 *
 * C'est une action serveur attachée à un `<form>` : la page fonctionne donc **sans JavaScript**,
 * comme les filtres de la liste. Rien n'est deviné — seules les valeurs présentes dans le
 * formulaire sont retenues, et chacune est validée contre le catalogue avant d'être écrite.
 */
export async function enregistrerProfil(donnees: FormData) {
  const noms = new Set(CATALOGUE.map((c) => c.nom));

  const niveauBrut = String(donnees.get("niveau") ?? "");
  const profil: Profil = {
    competences: donnees.getAll("competence").map(String).filter((n) => noms.has(n)),
    zones: donnees.getAll("zone").map(String).filter((z): z is Zone => ZONES.includes(z as Zone)),
    niveau: NIVEAUX.includes(niveauBrut as NiveauEtudes)
      ? (niveauBrut as NiveauEtudes)
      : PROFIL_DEFAUT.niveau,
    recherche: donnees
      .getAll("recherche")
      .map(String)
      .filter((r): r is TypeRecherche => RECHERCHES.includes(r as TypeRecherche)),
  };

  // Ne chercher ni stage ni alternance viderait le site sans rien dire : on retombe sur le
  // réglage de départ plutôt que d'afficher une page vide inexplicable.
  if (profil.recherche.length === 0) profil.recherche = PROFIL_DEFAUT.recherche;

  const magasin = await cookies();
  magasin.set(COOKIE_PROFIL, encoderProfil(profil), {
    maxAge: UN_AN,
    sameSite: "lax",
    path: "/",
    httpOnly: false,
  });

  revalidatePath("/", "layout");
  redirect("/profil?enregistre=1");
}

/**
 * Supprime le compte et tout ce qui s'y rattache.
 *
 * Côté base, une seule instruction suffit : `accounts` et `sessions` référencent `users (id) ON
 * DELETE CASCADE`, donc la ligne supprimée emporte les identités externes et les sessions
 * ouvertes. La cascade est dans le schéma plutôt que dans du code — c'est ce qui rend l'oubli
 * impossible.
 *
 * Mais effacer nos lignes ne suffisait pas. L'autorisation vit aussi chez Google, et elle y
 * restait : se reconnecter juste après une suppression ne demandait plus aucun consentement et
 * recréait un compte en un clic. On révoque donc **avant** de supprimer — après la cascade, les
 * jetons n'existent plus et il serait trop tard.
 *
 * L'ordre importe, l'échec non : si Google ne répond pas, la suppression a lieu quand même.
 * Retenir les données de quelqu'un parce qu'un tiers est injoignable serait le pire choix.
 *
 * Le cookie de profil est effacé dans la foulée : il vit dans le navigateur et ne serait pas
 * concerné par une suppression en base.
 */
export async function supprimerCompte() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/connexion");

  const revocation = await revoquerAccesGoogle(id);
  if (revocation.etat !== "revoque" && revocation.etat !== "rien-a-revoquer") {
    // Journalisé sans jeton ni adresse : on veut savoir que c'est arrivé, pas sur qui.
    console.warn(`[compte] révocation Google non aboutie : ${revocation.etat}`);
  }

  await base().query("delete from users where id = $1", [id]);

  const magasin = await cookies();
  magasin.delete(COOKIE_PROFIL);

  // Déconnexion après coup : la session n'existe plus en base, mais le cookie de session
  // traîne encore côté navigateur et doit partir aussi.
  await signOut({ redirectTo: "/?compte=supprime" });
}

/** Remet le profil d'usine — celui du pipeline. Le pendant honnête du « supprimer mes données ». */
export async function reinitialiserProfil() {
  const magasin = await cookies();
  magasin.delete(COOKIE_PROFIL);
  revalidatePath("/", "layout");
  redirect("/profil?reinitialise=1");
}
