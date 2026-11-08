-- Migration T7 : la zone « occitanie » devient une valeur permise.
--
-- Chantier zone (décision du 6 novembre 2026) : Toulouse, Occitanie et Île-de-France sont les trois
-- zones acceptées. Deux contraintes CHECK de la base ne connaissent que les quatre anciennes valeurs
-- (toulouse, idf, remote, autre) :
--
--   · offers.location_zone    sans cette migration, la copie horaire du collecteur échouerait sur la
--                             première offre d'Occitanie, et la transaction entière serait annulée
--                             (les offres, mais aussi la ligne de `collectes`) ;
--   · profiles.zones          sans elle, un profil qui choisit l'Occitanie ne pourrait pas s'écrire.
--
-- Un CHECK ne se modifie pas en place : on le remplace. Rejouable sans effet : le remplacement n'a
-- lieu que si la contrainte actuelle ne cite pas encore « occitanie ». Aucune donnée n'est touchée ;
-- les lignes déjà présentes respectent la nouvelle liste, qui est un sur-ensemble de l'ancienne. Le
-- tout est dans une transaction : en cas d'erreur, les anciennes contraintes restent en place.
--
-- À appliquer AVANT que le collecteur n'écrive la nouvelle zone, par la connexion directe (sans
-- « -pooler » dans l'hôte) :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migration-t7-zones.sql
--
-- Les mêmes instructions figurent dans db/schema.sql, pour une base créée de zéro.

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'offers'::regclass
                      AND conname = 'offers_location_zone_check'
                      AND pg_get_constraintdef(oid) LIKE '%occitanie%') THEN
        ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_location_zone_check;
        ALTER TABLE offers ADD CONSTRAINT offers_location_zone_check
            CHECK (location_zone IN ('toulouse', 'occitanie', 'idf', 'remote', 'autre'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'profiles'::regclass
                      AND conname = 'profiles_zones_check'
                      AND pg_get_constraintdef(oid) LIKE '%occitanie%') THEN
        ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_zones_check;
        ALTER TABLE profiles ADD CONSTRAINT profiles_zones_check
            CHECK (zones <@ ARRAY['toulouse', 'occitanie', 'idf', 'remote', 'autre']::text[]);
    END IF;
END $$;

COMMIT;
