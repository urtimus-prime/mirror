import urllib.request
import json
import os
import sys
import subprocess

# We assume standard GH or Hub auth, let's grab the token from somewhere, maybe git credential?
try:
    token_out = subprocess.check_output(['git', 'config', '--get', 'hub.oauthtoken']).decode('utf-8').strip()
except Exception:
    try:
        token_out = os.popen('gh auth token').read().strip()
    except Exception:
        token_out = ""

if not token_out:
    print("Could not find GitHub token to create repo. Trying to just run `git push` again in case SSH is configured for creation.")
    sys.exit(1)

req = urllib.request.Request("https://api.github.com/user/repos", data=json.dumps({"name": "urtimus-prime", "private": False}).encode('utf-8'))
req.add_header("Authorization", f"token {token_out}")
req.add_header("Accept", "application/vnd.github.v3+json")

try:
    resp = urllib.request.urlopen(req)
    print("Created successfully")
except urllib.error.HTTPError as e:
    print(e.read())
    sys.exit(1)
