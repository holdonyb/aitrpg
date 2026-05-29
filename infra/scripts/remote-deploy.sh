#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${APP_DOMAIN:-}" ]]; then
  echo "APP_DOMAIN is required" >&2
  exit 1
fi

if [[ -z "${LETSENCRYPT_EMAIL:-}" ]]; then
  echo "LETSENCRYPT_EMAIL is required" >&2
  exit 1
fi

if [[ -z "${DEPLOY_TARGET_DIR:-}" ]]; then
  echo "DEPLOY_TARGET_DIR is required" >&2
  exit 1
fi

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif docker-compose --version >/dev/null 2>&1; then
    echo "docker-compose"
  else
    echo "Docker Compose is not installed" >&2
    exit 1
  fi
}

render_template() {
  local input="$1"
  local output="$2"
  sed "s#__APP_DOMAIN__#${APP_DOMAIN}#g" "$input" > "$output"
}

mkdir -p /var/www/certbot
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

render_template \
  "${DEPLOY_TARGET_DIR}/infra/nginx/atrpg.http.conf.template" \
  "/etc/nginx/sites-available/${APP_DOMAIN}"

ln -sf "/etc/nginx/sites-available/${APP_DOMAIN}" "/etc/nginx/sites-enabled/${APP_DOMAIN}"
nginx -t
systemctl reload nginx

if [[ ! -d "/etc/letsencrypt/live/${APP_DOMAIN}" ]]; then
  certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "${APP_DOMAIN}" \
    --email "${LETSENCRYPT_EMAIL}" \
    --agree-tos \
    --non-interactive
fi

render_template \
  "${DEPLOY_TARGET_DIR}/infra/nginx/atrpg.https.conf.template" \
  "/etc/nginx/sites-available/${APP_DOMAIN}"

nginx -t
systemctl reload nginx

cd "${DEPLOY_TARGET_DIR}"
COMPOSE_CMD="$(compose_cmd)"
$COMPOSE_CMD -f infra/docker-compose.yml up --build -d
