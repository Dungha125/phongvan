import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("180.93.32.135", username="root", password="HpqWVMWrXiL7N0CI", timeout=30)

cmds = [
    "ls -la /etc/caddy 2>/dev/null; ls /etc/caddy/ 2>/dev/null",
    "find /etc/caddy -type f 2>/dev/null",
    "cat /etc/caddy/Caddyfile 2>/dev/null",
    "docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'",
    "ss -tlnp | awk '{print $4}' | sed 's/.*://' | sort -n | uniq",
]

for c in cmds:
    print(f"\n===== {c} =====")
    _i, o, e = ssh.exec_command(c, timeout=60)
    print(o.read().decode("utf-8", "replace"))
    err = e.read().decode("utf-8", "replace")
    if err.strip():
        print("ERR:", err)

ssh.close()
