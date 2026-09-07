#!/usr/bin/env bash
#
# Усиление свежего VPS. Дополняет scripts/provision-server.sh, который
# ставит пакеты, Docker и поднимает стек, но не трогает sshd.
#
# ВАЖНО: запускать под root только ПОСЛЕ того, как вход по ключу проверен
# в отдельной сессии. Скрипт выключает аутентификацию по паролю.
# Идемпотентен: повторный запуск безопасен.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"
ADMIN_PUBKEY="${ADMIN_PUBKEY:-}"

[ "$(id -u)" -eq 0 ] || { echo "Скрипт должен выполняться под root" >&2; exit 1; }
log() { printf '\n==> %s\n' "$*"; }

log "Пакеты безопасности"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq fail2ban unattended-upgrades apt-listchanges >/dev/null

log "Ключ деплой-пользователя"
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "Пользователь $DEPLOY_USER не найден — сначала запустите provision-server.sh" >&2
  exit 1
fi

if [ -n "$ADMIN_PUBKEY" ]; then
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
  touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
  grep -qxF "$ADMIN_PUBKEY" "/home/$DEPLOY_USER/.ssh/authorized_keys" \
    || echo "$ADMIN_PUBKEY" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
fi

# Предохранитель: без единого ключа выключение паролей отрезало бы доступ
# к серверу навсегда. Лучше упасть здесь.
if ! [ -s "/home/$DEPLOY_USER/.ssh/authorized_keys" ] && ! [ -s /root/.ssh/authorized_keys ]; then
  echo "Нет ни одного authorized_keys — отказ, иначе потеряете доступ к серверу" >&2
  echo "Передайте публичный ключ: ADMIN_PUBKEY='ssh-ed25519 AAAA...' bash $0" >&2
  exit 1
fi

log "sshd: только ключи, без входа по паролю"
mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/10-hardening.conf <<EOF
Port $SSH_PORT
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PermitEmptyPasswords no
X11Forwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers $DEPLOY_USER root
EOF

# Валидация до перезагрузки демона: битый конфиг не должен уронить sshd.
sshd -t
systemctl reload ssh 2>/dev/null || systemctl reload sshd

log "fail2ban для sshd"
cat > /etc/fail2ban/jail.d/sshd.local <<EOF
[sshd]
enabled  = true
port     = $SSH_PORT
backend  = systemd
maxretry = 4
findtime = 10m
bantime  = 1h
EOF
systemctl enable --now fail2ban >/dev/null
systemctl restart fail2ban

log "Автоматические обновления безопасности"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
systemctl enable --now unattended-upgrades >/dev/null

log "Файрвол"
ufw allow "$SSH_PORT/tcp" >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

log "Еженедельная чистка Docker"
# Каждый деплой тянет новые слои из GHCR. Без очистки диск VPS заполнится
# за пару месяцев и деплой начнёт падать на docker pull.
cat > /etc/systemd/system/docker-prune.service <<'EOF'
[Unit]
Description=Prune unused Docker data

[Service]
Type=oneshot
ExecStart=/usr/bin/docker system prune -af --filter "until=336h"
EOF

cat > /etc/systemd/system/docker-prune.timer <<'EOF'
[Unit]
Description=Weekly Docker prune

[Timer]
OnCalendar=Sun 04:30
RandomizedDelaySec=30m
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now docker-prune.timer >/dev/null

log "Готово"
echo "Проверьте вход по ключу в НОВОЙ сессии, не закрывая текущую."
echo "Статус банов: fail2ban-client status sshd"
