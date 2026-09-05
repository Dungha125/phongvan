import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("180.93.32.135", username="root", password="HpqWVMWrXiL7N0CI", timeout=30)

cmds = [
    "uname -a",
    "docker --version 2>/dev/null || echo NO_DOCKER",
    "docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || echo NO_COMPOSE",
    "ss -tlnp",
    "command -v nginx; command -v caddy; ls /etc/nginx/sites-enabled 2>/dev/null; ls /etc/nginx/conf.d 2>/dev/null",
    "ls /etc/letsencrypt/live 2>/dev/null | head",
    "df -h / | tail -1",
]

for c in cmds:
    print(f"\n===== {c} =====")
    _stdin, stdout, stderr = ssh.exec_command(c, timeout=60)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    print(out)
    if err.strip():
        print("ERR:", err)

ssh.close()
