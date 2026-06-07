#!/usr/bin/env python3
"""
KUZGU — Instagram profile lookup (instaloader)

Fetches PUBLIC profile metadata for a username and prints it as JSON.
Anonymous by default; if IG_SESSION_USER is set and a saved instaloader
session exists for it, the session is loaded for higher reliability.

Usage:  python3 ig_lookup.py <username> [postCount]
Output: single JSON line on stdout. On error: {"error": "..."} + exit 1.

One-time session setup (optional, improves reliability / avoids blocks):
    instaloader --login=<your_ig_username>
then run KUZGU with IG_SESSION_USER=<your_ig_username>.
"""
import json
import os
import re
import sys


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing username"}))
        sys.exit(1)

    username = sys.argv[1].strip().lstrip("@").lower()
    if not re.fullmatch(r"[a-z0-9._]{1,30}", username):
        print(json.dumps({"error": "invalid username"}))
        sys.exit(1)

    post_count = 0
    if len(sys.argv) > 2:
        try:
            post_count = max(0, min(int(sys.argv[2]), 12))
        except ValueError:
            post_count = 0

    try:
        import instaloader
    except ImportError:
        print(json.dumps({"error": "instaloader not installed"}))
        sys.exit(1)

    L = instaloader.Instaloader(
        quiet=True,
        download_pictures=False,
        download_videos=False,
        download_comments=False,
        save_metadata=False,
    )

    session_user = os.environ.get("IG_SESSION_USER")
    logged_in = False
    if session_user:
        try:
            L.load_session_from_file(session_user)
            logged_in = True
        except Exception:
            logged_in = False

    try:
        p = instaloader.Profile.from_username(L.context, username)
    except instaloader.exceptions.ProfileNotExistsException:
        print(json.dumps({"error": f"profile @{username} not found"}))
        sys.exit(1)
    except instaloader.exceptions.LoginRequiredException:
        print(json.dumps({"error": "Instagram requires login for this lookup. Set up a session (see ig_lookup.py header)."}))
        sys.exit(1)
    except instaloader.exceptions.ConnectionException as e:
        print(json.dumps({"error": f"Instagram blocked/ratelimited the request: {e}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"lookup failed: {e}"}))
        sys.exit(1)

    out = {
        "username": p.username,
        "userid": p.userid,
        "full_name": p.full_name,
        "biography": p.biography,
        "followers": p.followers,
        "following": p.followees,
        "posts": p.mediacount,
        "is_private": p.is_private,
        "is_verified": p.is_verified,
        "is_business": p.is_business_account,
        "business_category": p.business_category_name,
        "external_url": p.external_url,
        "profile_pic_url": p.profile_pic_url,
        "logged_in": logged_in,
        "recent_posts": [],
    }

    # Recent posts only when public (or session has access) and requested.
    if post_count > 0 and (not p.is_private or logged_in):
        try:
            for i, post in enumerate(p.get_posts()):
                if i >= post_count:
                    break
                out["recent_posts"].append({
                    "shortcode": post.shortcode,
                    "url": f"https://www.instagram.com/p/{post.shortcode}/",
                    "caption": (post.caption or "")[:280],
                    "likes": post.likes,
                    "comments": post.comments,
                    "is_video": post.is_video,
                    "date": post.date_utc.isoformat() if post.date_utc else None,
                })
        except Exception:
            pass  # profile already captured; ignore post-fetch failures

    print(json.dumps(out))


if __name__ == "__main__":
    main()
