"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

/** Remet le profil d'usine — celui du pipeline. Le pendant honnête du « supprimer mes données ». */
export async function reinitialiserProfil() {
  const magasin = await cookies();
  magasin.delete(COOKIE_PROFIL);
  revalidatePath("/", "layout");
  redirect("/profil?reinitialise=1");
}
