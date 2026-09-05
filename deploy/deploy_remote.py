"""Upload project + deploy interview-checkin API on VPS."""
from __future__ import annotations

import io
import tarfile
import time
from pathlib import Path

import paramiko

HOST = "180.93.32.135"
USER = "root"
PASSWORD = "HpqWVMWrXiL7N0CI"
REMOTE_DIR = "/opt/interview-checkin"
LOCAL_ROOT = Path(__file__).resolve().parents[1]

INCLUDE_FILES = [
    "Dockerfile",
    ".dockerignore",
    "docker-compose.yml",
    "package.json",
    "package-lock.json",
    "server/index.js",
]


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 300) -> tuple[int, str, str]:
    _i, o, e = ssh.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    return code, out, err


def main() -> None:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for rel in INCLUDE_FILES:
            path = LOCAL_ROOT / rel
            if not path.exists():
                raise SystemExit(f"missing {path}")
            tar.add(path, arcname=rel)
        caddy = LOCAL_ROOT / "deploy" / "pv-api.caddy"
        tar.add(caddy, arcname="deploy/pv-api.caddy")
    buf.seek(0)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = ssh.open_sftp()

    log: list[str] = []

    def log_run(cmd: str, timeout: int = 300) -> None:
        code, out, err = run(ssh, cmd, timeout=timeout)
        log.append(f"$ {cmd}\nexit={code}\n{out}\n{err}\n")
        if code != 0:
            raise RuntimeError(f"command failed ({code}): {cmd}\n{out}\n{err}")

    # Ensure port 8011 free
    code, out, err = run(ssh, "ss -tlnp | grep -E ':8011\\b' || true")
    log.append(f"port check 8011:\n{out}{err}\n")
    if ":8011" in out:
        raise RuntimeError("Port 8011 already in use, aborting")

    log_run(f"mkdir -p {REMOTE_DIR}")
    remote_tar = f"{REMOTE_DIR}/bundle.tar.gz"
    with sftp.file(remote_tar, "wb") as rf:
        rf.write(buf.getvalue())

    log_run(f"cd {REMOTE_DIR} && tar -xzf bundle.tar.gz && rm -f bundle.tar.gz")
    log_run(
        f"cd {REMOTE_DIR} && docker compose build --no-cache && docker compose up -d",
        timeout=600,
    )
    log_run("cp /opt/interview-checkin/deploy/pv-api.caddy /etc/caddy/sites/pv-api.caddy")
    log_run("caddy validate --config /etc/caddy/Caddyfile")
    log_run("systemctl reload caddy")

    time.sleep(2)
    code, out, err = run(ssh, "curl -sS http://127.0.0.1:8011/health")
    log.append(f"local health: exit={code}\n{out}\n{err}\n")
    code, out, err = run(ssh, "curl -sS http://127.0.0.1:8011/api/state")
    log.append(f"local state: exit={code}\n{out}\n{err}\n")
    code, out, err = run(
        ssh, "curl -sS -o /tmp/pv_api_test.txt -w '%{http_code}' https://api.pv.lcdkhoacntt1.com/health"
    )
    body = ""
    try:
        _c, body, _e = run(ssh, "cat /tmp/pv_api_test.txt")
    except Exception:
        pass
    log.append(f"public health http={out} body={body}\n{err}\n")
    code, out, err = run(
        ssh, "docker ps --filter name=interview-checkin-api --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'"
    )
    log.append(f"container:\n{out}\n{err}\n")

    sftp.close()
    ssh.close()

    out_path = Path(__file__).with_name("deploy_log.txt")
    out_path.write_text("\n".join(log), encoding="utf-8")
    print("done ->", out_path)


if __name__ == "__main__":
    main()
