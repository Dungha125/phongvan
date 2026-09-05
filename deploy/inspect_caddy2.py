import paramiko
from pathlib import Path

out_path = Path(__file__).with_name("server_info.txt")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("180.93.32.135", username="root", password="HpqWVMWrXiL7N0CI", timeout=30)

cmds = [
    "cat /etc/caddy/Caddyfile",
    "ls -la /etc/caddy/sites",
    "cat /etc/caddy/sites/*.caddy",
    "docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'",
    "ss -tlnp",
    "grep -R \"reverse_proxy\\|localhost:\\|127.0.0.1:\" /etc/caddy -n",
]

chunks = []
for c in cmds:
    chunks.append(f"\n===== {c} =====\n")
    _i, o, e = ssh.exec_command(c, timeout=60)
    chunks.append(o.read().decode("utf-8", "replace"))
    err = e.read().decode("utf-8", "replace")
    if err.strip():
        chunks.append("ERR:\n" + err)

ssh.close()
out_path.write_text("".join(chunks), encoding="utf-8")
print("wrote", out_path)
