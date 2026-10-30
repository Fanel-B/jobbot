/**
 * La révocation ne doit jamais empêcher une suppression.
 *
 * C'est la propriété qui compte ici, et elle est invisible à l'œil : le jour où Google renvoie
 * une erreur, personne ne s'en apercevra — sauf si `supprimerCompte` lève et laisse le compte en
 * place. Ces tests épinglent les deux règles qui font que ça n'arrive pas : aucune exception ne
 * sort de la fonction, et un 400 compte comme un succès parce qu'il veut dire « ce jeton ne vaut
 * déjà plus rien ».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requete = vi.fn();
vi.mock("./db", () => ({ base: () => ({ query: requete }) }));

const { revoquerAccesGoogle } = await import("./google");

/** Un compte qui possède les deux jetons, ou seulement celui qu'on nomme. */
function compteAvec(jetons: { refresh_token?: string | null; access_token?: string | null }) {
  requete.mockResolvedValue({
    rows: [{ refresh_token: null, access_token: null, ...jetons }],
  });
}

beforeEach(() => {
  requete.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("choix du jeton", () => {
  it("préfère le jeton de rafraîchissement, qui emporte les autres", async () => {
    compteAvec({ refresh_token: "rafraichissement", access_token: "acces" });
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 200 }));

    await revoquerAccesGoogle("1");

    const corps = vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams;
    expect(corps.get("token")).toBe("rafraichissement");
  });

  it("se rabat sur le jeton d'accès quand il n'y a que lui", async () => {
    compteAvec({ access_token: "acces" });
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 200 }));

    await revoquerAccesGoogle("1");

    const corps = vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams;
    expect(corps.get("token")).toBe("acces");
  });

  it("n'appelle pas Google quand il n'y a aucun jeton", async () => {
    compteAvec({});
    expect(await revoquerAccesGoogle("1")).toEqual({ etat: "rien-a-revoquer" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("n'appelle pas Google quand la personne n'a pas de compte Google", async () => {
    requete.mockResolvedValue({ rows: [] });
    expect(await revoquerAccesGoogle("1")).toEqual({ etat: "rien-a-revoquer" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("lecture de la réponse de Google", () => {
  it("compte un 200 comme révoqué", async () => {
    compteAvec({ refresh_token: "j" });
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 200 }));
    expect(await revoquerAccesGoogle("1")).toEqual({ etat: "revoque" });
  });

  it("compte un 400 comme révoqué, parce que le jeton ne vaut déjà plus rien", async () => {
    compteAvec({ refresh_token: "j" });
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 400 }));
    expect(await revoquerAccesGoogle("1")).toEqual({ etat: "revoque" });
  });

  it("signale un refus sans le confondre avec un succès", async () => {
    compteAvec({ refresh_token: "j" });
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 401 }));
    expect(await revoquerAccesGoogle("1")).toEqual({ etat: "refus", code: 401 });
  });
});

describe("rien ne doit jamais être levé", () => {
  it("rend un état quand le réseau tombe", async () => {
    compteAvec({ refresh_token: "j" });
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));
    expect(await revoquerAccesGoogle("1")).toEqual({ etat: "injoignable", cause: "TypeError" });
  });

  it("rend un état quand la base tombe", async () => {
    requete.mockRejectedValue(new Error("connexion refusée"));
    const r = await revoquerAccesGoogle("1");
    expect(r.etat).toBe("injoignable");
  });

  it("ne laisse échapper aucune exception, quel que soit l'échec", async () => {
    // La garantie que `supprimerCompte` continue : si cette promesse rejetait, la ligne `users`
    // ne serait jamais supprimée et la personne resterait en base après avoir demandé l'inverse.
    for (const panne of [new Error("boum"), "pas une erreur", null]) {
      requete.mockRejectedValue(panne);
      await expect(revoquerAccesGoogle("1")).resolves.toBeDefined();
    }
  });
});
