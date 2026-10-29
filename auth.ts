/**
 * Auth.js — la connexion par compte Google.
 *
 * Deux décisions qui ne sont pas des détails :
 *
 * **Les sessions vivent en base, pas dans un JWT.** Un jeton déjà émis ne se révoque pas : avec
 * une session JWT, « se déconnecter » ou « supprimer mon compte » laisserait le porteur du jeton
 * connecté jusqu'à son expiration. Le cahier de route exige un bouton de suppression qui
 * fonctionne vraiment ; une ligne supprimée dans `sessions` prend effet à la requête suivante.
 *
 * **La suppression en cascade est dans le schéma.** `accounts` et `sessions` référencent
 * `users (id) ON DELETE CASCADE` : effacer la personne efface ses identités externes et ses
 * sessions, sans code à écrire ni oubli possible.
 *
 * Le pilote `pg` ne tourne pas sur le runtime edge. Il n'y a donc volontairement pas de
 * middleware d'authentification — les pages protégées vérifient la session côté serveur, dans
 * une frontière <Suspense> comme l'impose `cacheComponents`.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import PostgresAdapter from "@auth/pg-adapter";
import { base } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth(() => ({
  // Le pool est créé à la première requête, pas à l'import : au build, `DATABASE_URL`
  // peut être absente et rien ne doit tenter de se connecter.
  adapter: PostgresAdapter(base()),

  providers: [Google],

  session: { strategy: "database" },

  // Vercel sert le site derrière un proxy : sans ça, l'URL de rappel est reconstruite à partir
  // d'en-têtes qu'Auth.js refuse par défaut.
  trustHost: true,

  pages: {
    signIn: "/connexion",
    error: "/connexion",
  },

  callbacks: {
    /**
     * L'identifiant de la personne est exposé à l'application, pas seulement son e-mail.
     * C'est lui qui reliera un profil à son propriétaire quand les profils passeront en base.
     */
    session({ session, user }) {
      if (session.user) session.user.id = String(user.id);
      return session;
    },
  },
}));
