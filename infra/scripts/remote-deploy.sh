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

if [[ -z "${OPENAI_BASE_URL:-}" || -z "${OPENAI_API_KEY:-}" || -z "${OPENAI_TEXT_MODEL:-}" || -z "${OPENAI_IMAGE_MODEL:-}" || -z "${OPENAI_VIDEO_MODEL:-}" || -z "${JWT_SECRET:-}" ]]; then
  echo "AI and auth secrets are required" >&2
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

cat > "${DEPLOY_TARGET_DIR}/.env.production" <<EOF
NODE_ENV=production
APP_URL=https://${APP_DOMAIN}
API_URL=http://127.0.0.1:4000
NEXT_PUBLIC_API_URL=/api

DATABASE_URL=postgresql://atrpg:atrpg@postgres:5432/atrpg
REDIS_URL=redis://redis:6379

JWT_SECRET=${JWT_SECRET}
EMAIL_FROM=no-reply@${APP_DOMAIN}
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=

OPENAI_BASE_URL=${OPENAI_BASE_URL}
OPENAI_API_KEY=${OPENAI_API_KEY}
OPENAI_TEXT_MODEL=${OPENAI_TEXT_MODEL}
OPENAI_IMAGE_MODEL=${OPENAI_IMAGE_MODEL}
OPENAI_VIDEO_MODEL=${OPENAI_VIDEO_MODEL}

S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=atrpg-assets
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
EOF

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
$COMPOSE_CMD -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up --build -d
