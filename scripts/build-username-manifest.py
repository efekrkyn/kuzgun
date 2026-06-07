#!/usr/bin/env python3
"""
Build the unified username-enumeration manifest for KUZGU.

Merges:
  - maigret  (soxoj/maigret, ~3000 sites, richer presence/absence detection)
  - sherlock (sherlock-project, proven baseline)

Output: src/lib/sherlock-data.json in the KUZGU RawSite shape consumed by
src/lib/sherlock.ts. Re-run to refresh:

    python3 scripts/build-username-manifest.py /tmp/maigret.json /tmp/sherlock_data.json

(Download sources first:)
    curl -sL https://raw.githubusercontent.com/soxoj/maigret/main/maigret/resources/data.json -o /tmp/maigret.json
    curl -sL https://raw.githubusercontent.com/sherlock-project/sherlock/master/sherlock_project/resources/data.json -o /tmp/sherlock_data.json
"""
import json, sys, os

NSFW_TAGS = {"porn", "erotic", "adult", "xxx"}

def norm_template(url: str) -> str:
    return url.replace("{username}", "{}")

def template_key(url: str) -> str:
    # dedupe key: scheme-agnostic url template
    return norm_template(url).lower().replace("https://", "").replace("http://", "").replace("www.", "").rstrip("/")

def convert_maigret(maigret_path):
    data = json.load(open(maigret_path))["sites"]
    out = {}
    for name, s in data.items():
        if not isinstance(s, dict):
            continue
        if s.get("disabled"):
            continue
        ctype = s.get("checkType")
        url = s.get("url")
        if not url or "{username}" not in url:
            continue
        absence = s.get("absenceStrs")
        presence = s.get("presenseStrs")
        err_url = s.get("errorUrl")

        # Only keep sites we can detect reliably with our engine.
        if ctype == "status_code":
            pass  # always usable
        elif ctype == "message":
            if not absence and not presence:
                continue  # nothing to match on
        elif ctype == "response_url":
            if not err_url and not absence and not presence:
                continue  # would be a blind 2xx guess
        else:
            continue  # None / unknown checkType

        entry = {
            "url": norm_template(url),
            "urlMain": s.get("urlMain"),
            "errorType": ctype,
        }
        if s.get("regexCheck"):
            entry["regexCheck"] = s["regexCheck"]
        if err_url:
            entry["errorUrl"] = norm_template(err_url)
        if absence:
            entry["absenceStrs"] = absence
        if presence:
            entry["presenseStrs"] = presence
        if set(t.lower() for t in s.get("tags", [])) & NSFW_TAGS:
            entry["isNSFW"] = True
        out[name] = entry
    return out

def add_sherlock(combined, sherlock_path):
    data = json.load(open(sherlock_path))
    seen = {template_key(v["url"]) for v in combined.values() if "url" in v}
    seen_names = {n.lower() for n in combined}
    added = 0
    for name, s in data.items():
        if name == "$schema" or not isinstance(s, dict) or "url" not in s:
            continue
        if template_key(s["url"]) in seen or name.lower() in seen_names:
            continue
        entry = {"url": s["url"], "urlMain": s.get("urlMain"), "errorType": s.get("errorType")}
        for k in ("errorMsg", "errorUrl", "regexCheck"):
            if k in s:
                entry[k] = s[k]
        if s.get("isNSFW"):
            entry["isNSFW"] = True
        # avoid name clash
        key = name if name not in combined else f"{name} (sherlock)"
        combined[key] = entry
        seen.add(template_key(s["url"]))
        added += 1
    return added

def main():
    maigret_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/maigret.json"
    sherlock_path = sys.argv[2] if len(sys.argv) > 2 else "/tmp/sherlock_data.json"
    out_path = os.path.join(os.path.dirname(__file__), "..", "src", "lib", "sherlock-data.json")

    combined = convert_maigret(maigret_path)
    print(f"maigret usable sites: {len(combined)}")
    if os.path.exists(sherlock_path):
        added = add_sherlock(combined, sherlock_path)
        print(f"sherlock sites added (not already present): {added}")
    print(f"TOTAL sites: {len(combined)}")

    with open(os.path.abspath(out_path), "w") as f:
        json.dump(combined, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {os.path.abspath(out_path)}")

if __name__ == "__main__":
    main()
