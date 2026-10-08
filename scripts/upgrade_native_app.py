#!/usr/bin/env python3
"""
Upgrade an already-installed Supply Chain 360 Native App to a new patch (run once per region).

deploy_native_app.py handles the FIRST install (REGISTER VERSION v2, CREATE
APPLICATION). This script ships a change on top of it:

  1. Upload the 4 app artifacts to SUPPLY_CHAIN_360_PKG.PUBLIC.APP_STAGE
  2. ADD PATCH FOR VERSION V2 (the image digest in the registry is captured now,
     so push the image with build_and_push.sh first)
  3. Point the DEFAULT release channel's default directive at the new patch
     (org-listing consumers pick it up from there)
  4. ALTER APPLICATION SUPPLY_CHAIN_360_APP UPGRADE (or, for a dev-mode install
     created from the package stage, re-stage to STAGE_CONTENT.APP_CODE/app and
     UPGRADE USING that path) in this account, re-run
     version_init() so the service restarts on the new image, and print status

Assumes the package data is already bundled (migrate_data.py).

Usage:
  python upgrade_native_app.py --target dfreriksdemo
  python upgrade_native_app.py --target dfreriks_eu_demo --label "BDC Sources & Lineage page"
"""
import argparse
import os
import time

from deploy_native_app import APP, APP_DIR, FILES, PKG, connect

VERSION = "V2"
# Stage path a dev-mode (unversioned) install was created from.
DEV_STAGE = f"{PKG}.STAGE_CONTENT.APP_CODE/app"


def upgrade(target, wh, label):
    conn = connect(target, warehouse=wh)
    cur = conn.cursor()
    cur.execute(f"USE WAREHOUSE {wh}")

    cur.execute(f"DESCRIBE APPLICATION {APP}")
    dev_mode = dict((r[0], r[1]) for r in cur.fetchall()).get("version") == "UNVERSIONED"

    if dev_mode:
        # Installed straight from the package stage (snow app run): re-stage the
        # artifacts where it was installed from and upgrade from that path.
        for f in FILES:
            p = os.path.abspath(os.path.join(APP_DIR, f))
            cur.execute(f"PUT 'file://{p}' @{DEV_STAGE} AUTO_COMPRESS=FALSE OVERWRITE=TRUE")
        cur.execute(f"ALTER APPLICATION {APP} UPGRADE USING '@{DEV_STAGE}'")
        print(f"{target}: {APP} (dev mode) upgraded from @{DEV_STAGE}")
    else:
        cur.execute(f"CREATE SCHEMA IF NOT EXISTS {PKG}.PUBLIC")
        cur.execute(f"CREATE STAGE IF NOT EXISTS {PKG}.PUBLIC.APP_STAGE ENCRYPTION=(TYPE='SNOWFLAKE_SSE')")
        for f in FILES:
            p = os.path.abspath(os.path.join(APP_DIR, f))
            cur.execute(f"PUT 'file://{p}' @{PKG}.PUBLIC.APP_STAGE AUTO_COMPRESS=FALSE OVERWRITE=TRUE")
        print(f"{target}: artifacts staged")

        cur.execute(f"ALTER APPLICATION PACKAGE {PKG} ADD PATCH FOR VERSION {VERSION} "
                    f"USING '@{PKG}.PUBLIC.APP_STAGE' LABEL = '{label}'")
        row = cur.fetchone()
        cur.execute(f"SHOW VERSIONS IN APPLICATION PACKAGE {PKG}")
        cols = [d[0] for d in cur.description]
        patch = max(int(dict(zip(cols, r))["patch"]) for r in cur.fetchall()
                    if dict(zip(cols, r))["version"] == VERSION)
        print(f"{target}: added patch {VERSION}.{patch} ({row})")

        cur.execute(f"ALTER APPLICATION PACKAGE {PKG} MODIFY RELEASE CHANNEL DEFAULT "
                    f"SET DEFAULT RELEASE DIRECTIVE VERSION={VERSION} PATCH={patch}")
        print(f"{target}: DEFAULT channel -> {VERSION}.{patch}")
        # An install that follows a release channel takes the channel's directive
        # (often already applied by the time we get here); UPGRADE USING VERSION
        # is rejected for it, so a plain UPGRADE is the right call.
        cur.execute(f"DESCRIBE APPLICATION {APP}")
        if dict((r[0], r[1]) for r in cur.fetchall()).get("release_channel_name"):
            cur.execute(f"ALTER APPLICATION {APP} UPGRADE")
        else:
            cur.execute(f"ALTER APPLICATION {APP} UPGRADE USING VERSION {VERSION} PATCH {patch}")
    cur.execute(f"CALL {APP}.CORE.VERSION_INIT()")
    print(f"{target}: {APP} upgraded; {cur.fetchone()[0]}")

    for _ in range(40):
        cur.execute(f"SHOW SERVICES IN APPLICATION {APP}")
        cols = [d[0] for d in cur.description]
        svc = dict(zip(cols, cur.fetchone()))
        if svc["status"] == "RUNNING":
            break
        time.sleep(15)
    print(f"{target}: service {svc['status']}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", required=True)
    ap.add_argument("--warehouse", default="COMPUTE_WH")
    ap.add_argument("--label", default="BDC Sources & Lineage page")
    a = ap.parse_args()
    upgrade(a.target, a.warehouse, a.label)
