bash -lc 'set -euo pipefail;TS="$(date +%Y%m%d_%H%M%S)";OUT="/tmp/VPS_EAGLE_${TS}";mkdir -p "$OUT";R="$OUT/report.txt";exec > >(tee -a "$R") 2>&1;
sec(){ echo; echo "==================== $1 ===================="; }
cmd(){ echo; echo "$ $*"; ( "$@" ) || echo "[WARN] failed: $*"; }

sec "META";
cmd date; cmd hostnamectl; cmd uname -a; cmd whoami; cmd id; cmd uptime; cmd timedatectl || true; cmd last -x | head -n 20 || true;

sec "OS / PACKAGES";
cmd bash -lc "cat /etc/os-release 2>/dev/null || true";
cmd dpkg -l | awk "NR==1||NR==2||NR==3||/nginx|certbot|ufw|fail2ban|nodejs|pm2|docker|postgres|redis|python3|git|wireguard/ {print}" || true;
cmd systemctl is-enabled unattended-upgrades 2>/dev/null || true;

sec "USERS / SUDO / SSH (NO SECRETS)";
cmd bash -lc "cut -d: -f1,3,4,6,7 /etc/passwd | sort -t: -k2,2n | tail -n 80";
cmd bash -lc "getent group sudo 2>/dev/null || true; getent group wheel 2>/dev/null || true";
cmd bash -lc "grep -R \"^[^#]*Port\\|^[^#]*PermitRootLogin\\|^[^#]*PasswordAuthentication\\|^[^#]*PubkeyAuthentication\\|^[^#]*AllowUsers\\|^[^#]*AllowGroups\" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/* 2>/dev/null || true";

sec "CPU / RAM / DISK";
cmd bash -lc "nproc; lscpu | sed -n \"1,35p\"";
cmd free -h;
cmd df -hT;
cmd bash -lc "du -sh /var/log /var/www /home /etc/nginx /etc/letsencrypt 2>/dev/null || true";

sec "NETWORK (LISTEN, ROUTES, DNS)";
cmd ip -br a; cmd ip route;
cmd bash -lc "cat /etc/resolv.conf 2>/dev/null || true";
cmd ss -tulpn | sed -n "1,200p";

sec "FIREWALL";
cmd ufw status verbose || true;
cmd bash -lc "nft list ruleset 2>/dev/null | sed -n \"1,220p\" || true";
cmd bash -lc "iptables -S 2>/dev/null | sed -n \"1,220p\" || true";

sec "SYSTEMD (RUNNING SERVICES SNAPSHOT)";
cmd systemctl --no-pager --type=service --state=running | sed -n "1,220p";

sec "NGINX (CONFIG + VHOST MAP)";
cmd nginx -t || true;
cmd nginx -V || true;
cmd bash -lc "ls -la /etc/nginx 2>/dev/null || true; ls -la /etc/nginx/sites-enabled 2>/dev/null || true";
cmd bash -lc "grep -R \"^[[:space:]]*server_name\\|^[[:space:]]*listen\\|proxy_pass\\|root\\|ssl_certificate\\|ssl_certificate_key\\|location /ws\\|upgrade\\|connection\" /etc/nginx/sites-enabled /etc/nginx/conf.d /etc/nginx/nginx.conf 2>/dev/null | sed -n \"1,260p\" || true";

sec "TLS / CERTBOT (DATES ONLY)";
cmd certbot certificates 2>/dev/null || true;
cmd bash -lc "for f in /etc/letsencrypt/live/*/fullchain.pem; do [ -f \"$f\" ] || continue; echo; echo \"-- $f\"; openssl x509 -in \"$f\" -noout -subject -issuer -dates 2>/dev/null || true; done";

sec "NODE / PM2 / DOCKER";
cmd bash -lc "command -v node && node -v || true";
cmd bash -lc "command -v npm && npm -v || true";
cmd bash -lc "command -v corepack && corepack --version || true";
cmd bash -lc "command -v pm2 && pm2 -v && pm2 ls || true";
cmd bash -lc "command -v docker && docker --version && docker ps --format \"table {{.Names}}\\t{{.Status}}\\t{{.Ports}}\" || true";

sec "WEB CHECK (LOCAL ONLY)";
cmd bash -lc "curl -sS -I --max-time 3 http://127.0.0.1:80 2>/dev/null | sed -n \"1,40p\" || true";
cmd bash -lc "curl -sS -I --max-time 3 https://127.0.0.1:443 -k 2>/dev/null | sed -n \"1,40p\" || true";

sec "LOGS (LAST LINES)";
cmd bash -lc "journalctl -p 0..4 --no-pager -n 120 2>/dev/null || true";
cmd bash -lc "tail -n 120 /var/log/nginx/error.log 2>/dev/null || true";
cmd bash -lc "tail -n 120 /var/log/nginx/access.log 2>/dev/null || true";
cmd bash -lc "tail -n 120 /var/log/auth.log 2>/dev/null || true";
cmd bash -lc "tail -n 120 /var/log/fail2ban.log 2>/dev/null || true";

sec "INTEGRITY (HASH CONFIG FILES ONLY, NO .env CONTENT)";
cmd bash -lc "find /etc/nginx -maxdepth 3 -type f \\( -name \"*.conf\" -o -name \"*.pem\" -o -name \"*.crt\" -o -name \"*.key\" \\) -print0 2>/dev/null | xargs -0 -I{} sh -lc \"stat -c \\\"%A %U:%G %s %n\\\" \\\"{}\\\";\" | sed -n \"1,260p\" || true";
cmd bash -lc "find /etc/systemd/system -maxdepth 2 -type f -name \"*.service\" -print0 2>/dev/null | xargs -0 -I{} sh -lc \"echo; stat -c \\\"%A %U:%G %s %n\\\" \\\"{}\\\"; sha256sum \\\"{}\\\";\" | sed -n \"1,260p\" || true";
cmd bash -lc "find /var/www -maxdepth 3 -type f \\( -name \"*.js\" -o -name \"*.html\" -o -name \"*.css\" \\) -print0 2>/dev/null | head -z -n 200 | xargs -0 -I{} sh -lc \"sha256sum \\\"{}\\\"\" | sed -n \"1,260p\" || true";
cmd bash -lc "find /var/www -maxdepth 4 -type f -name \".env\" -o -name \"*.env\" 2>/dev/null | sed -n \"1,120p\" || true";

sec "DONE";
echo \"Report: $R\";
tar -czf \"$OUT.tgz\" -C \"/tmp\" \"VPS_EAGLE_${TS}\" 2>/dev/null || true;
echo \"Bundle: $OUT.tgz\";
' 