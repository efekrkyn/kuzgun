#!/usr/bin/env python3
"""
KUZGU — GHunt email runner (direct API, bug-resistant).

GHunt 2.3.4 (PyPI) has two bugs that break `ghunt email --json`:
  1. KeyError('container') in people parser (Google changed cover-photo shape)
  2. NameError 'photos'/'reviews' in the email module's JSON export block

Instead of editing the pip package, this script calls GHunt's lower-level APIs
directly and serializes the result with GHunt's own GHuntEncoder, sidestepping
both bugs. Output (profile + maps stats, or an {"error": ...}) is written as
JSON to the given path.

Usage: python3 ghunt_email.py <email> <output_json_path>
"""
import sys
import json
import asyncio


def write(out, obj):
    with open(out, "w", encoding="utf-8") as f:
        f.write(obj if isinstance(obj, str) else json.dumps(obj))


async def run(email, out):
    try:
        from ghunt.helpers.utils import get_httpx_client
        from ghunt.apis.peoplepa import PeoplePaHttp
        from ghunt.helpers import gmaps, auth
        from ghunt.objects.encoders import GHuntEncoder
        import ghunt.parsers.people as people_mod
        from ghunt.errors import GHuntInvalidSession
    except ImportError as e:
        write(out, {"error": f"ghunt import failed: {e}"})
        return

    # Runtime safety patch for the cover-photo KeyError.
    _orig = people_mod.Person._scrape

    async def _safe(self, *a, **k):
        try:
            return await _orig(self, *a, **k)
        except (KeyError, TypeError, IndexError):
            return None

    people_mod.Person._scrape = _safe

    as_client = get_httpx_client()
    try:
        try:
            creds = await auth.load_and_auth(as_client)
        except GHuntInvalidSession:
            write(out, {"error": "not_authenticated"})
            return

        people_pa = PeoplePaHttp(creds)
        is_found, target = await people_pa.people_lookup(as_client, email, params_template="max_details")
        if not is_found:
            write(out, {"error": "not_found"})
            return

        result = {"profile": target}
        try:
            err, stats = await gmaps.get_reviews(as_client, target.personId)
            if not err:
                result["maps_stats"] = stats
        except Exception:
            pass

        write(out, json.dumps({"PROFILE_CONTAINER": result}, cls=GHuntEncoder))
    except Exception as e:
        write(out, {"error": f"lookup_failed: {type(e).__name__}: {e}"})
    finally:
        try:
            await as_client.aclose()
        except Exception:
            pass


def main():
    if len(sys.argv) < 3:
        print("usage: ghunt_email.py <email> <output_json>", file=sys.stderr)
        sys.exit(2)
    asyncio.run(run(sys.argv[1], sys.argv[2]))


if __name__ == "__main__":
    main()
