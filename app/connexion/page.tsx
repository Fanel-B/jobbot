import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { auth, signIn } from "@/auth";

export const metadata: Metadata = {
  title: "Se connecter - JobBot",
  description: "Connexion par compte Google. Aucun mot de passe à retenir, aucun à stocker.",
};

/**
 * La page de connexion.
 *
 * Elle dit ce qu'elle prend **avant** qu'on clique, pas après. C'est la contrepartie de la règle
 * du cahier de route : « une phrase claire à l'inscription — ce qui est stocké, pourquoi ».
 *
 * La lecture de session se fait dans une frontière <Suspense> : avec `cacheComponents`, elle a
 * lieu à la requête et ne peut pas entrer dans la coquille pré-rendue.
 */
async function Formulaire({ searchParams }: { searchParams: Promise<{ error?: string; suite?: string }> }) {
  const { error, suite } = await searchParams;
  await connection();
  const session = await auth();

  // Déjà connecté : rien à faire ici.
  if (session?.user) redirect(suite && suite.startsWith("/") ? suite : "/profil");

  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <p className="compteur">Connexion</p>
      <h1 className="titre-page mt-3">Garder ton profil</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        Sans compte, le site marche déjà : les offres sont les mêmes pour tout le monde et ton
        profil vit dans ce navigateur. Un compte sert à le retrouver ailleurs, et plus tard, à
        garder tes offres mises de côté.
      </p>

      {error ? (
        <p className="mt-6 rounded-card border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
          La connexion n&apos;a pas abouti. Réessaie ; si ça recommence, dis-le-moi plutôt que
          d&apos;insister.
        </p>
      ) : null}

      <form
        className="mt-8"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: suite && suite.startsWith("/") ? suite : "/profil" });
        }}
      >
        <button type="submit" className="bouton-plein w-full px-5 py-3.5 text-sm font-medium">
          Continuer avec Google
        </button>
      </form>

      <section className="mt-10 border-t border-line pt-6">
        <h2 className="label">Ce que ça stocke</h2>
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-muted">
          <li>
            Ton <strong className="font-medium text-ink-soft">adresse e-mail</strong>, ton nom et
            ton avatar, tels que Google les transmet.
          </li>
          <li>
            Une <strong className="font-medium text-ink-soft">session</strong> en base, pour te
            reconnaître d&apos;une visite à l&apos;autre.
          </li>
          <li>
            Ton profil de compétences, s&apos;il y en a un : c&apos;est tout l&apos;intérêt.
          </li>
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Pas de mot de passe : il n&apos;y en a aucun à retenir, et donc aucun à perdre ici.
          Aucune donnée n&apos;est revendue ni partagée. Le bouton{" "}
          <strong className="font-medium text-ink-soft">« supprimer mon compte »</strong> efface
          tout, sessions comprises.
        </p>
        <p className="mt-4 text-xs text-muted">
          Le détail est sur{" "}
          <Link href="/confidentialite" className="lien-anime text-accent">
            la page données et mentions légales
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

function Squelette() {
  return (
    <div className="mx-auto max-w-lg px-5 py-16" aria-hidden>
      <div className="h-3 w-24 rounded bg-paper-deep" />
      <div className="mt-4 h-10 w-72 max-w-full rounded bg-paper-deep" />
      <div className="mt-8 h-12 rounded-lg bg-paper-deep/70" />
    </div>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; suite?: string }>;
}) {
  return (
    <Suspense fallback={<Squelette />}>
      <Formulaire searchParams={searchParams} />
    </Suspense>
  );
}
