/**
 * Les routes d'Auth.js : connexion, rappel du fournisseur, déconnexion, session.
 *
 * `/api/auth/callback/google` est l'URI de redirection déclarée dans la console Google. La
 * changer ici obligerait à la changer là-bas, et une redirection non déclarée est refusée par
 * Google sans message utile.
 */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
