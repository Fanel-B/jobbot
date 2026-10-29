import Link from "next/link";
import { connection } from "next/server";
import { auth, signOut } from "@/auth";

/**
 * L'état de connexion, dans l'en-tête.
 *
 * Lit la session, donc vit forcément dans une frontière <Suspense> : avec `cacheComponents`, une
 * lecture de session a lieu à la requête et ne peut pas entrer dans la coquille pré-rendue.
 */
export async function Compte() {
  // `auth()` génère un jeton CSRF : une valeur instable, que Next refuse de pré-rendre.
  // `connection()` arrête le pré-rendu ici et bascule la suite à l'heure de la requête.
  await connection();
  const session = await auth();

  if (!session?.user) {
    return (
      <Link
        href="/connexion"
        className="rounded-md px-3 py-1.5 text-sm text-ink-soft transition hover:bg-paper-deep hover:text-ink"
      >
        Se connecter
      </Link>
    );
  }

  const nom = session.user.name ?? session.user.email ?? "Mon compte";

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/profil"
        className="max-w-[9rem] truncate rounded-md px-3 py-1.5 text-sm text-ink-soft transition hover:bg-paper-deep hover:text-ink"
        title={nom}
      >
        {nom}
      </Link>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="rounded-md px-2.5 py-1.5 text-sm text-muted transition hover:bg-paper-deep hover:text-ink"
        >
          Quitter
        </button>
      </form>
    </div>
  );
}

/** Même encombrement pendant la lecture de session, pour que l'en-tête ne saute pas. */
export function CompteSquelette() {
  return <div className="h-7 w-24 rounded-md bg-paper-deep" aria-hidden />;
}
