#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${APP_DOMAIN:-}" ]]; then
  echo "APP_DOMAIN is required" >&2
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

log_host_resources() {
  echo "=== host resources ==="
  free -h || true
  echo "---"
  df -h / /var/lib/docker || true
}

run_db_push_with_retry() {
  local compose_cmd="$1"
  local max_attempts="${2:-5}"
  local attempt
  local exit_code

  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    echo "Running prisma db push (attempt ${attempt}/${max_attempts})"
    set +e
    $compose_cmd -f infra/docker-compose.yml -f infra/docker-compose.prod.yml exec -T api \
      pnpm --filter api exec prisma db push --skip-generate --schema prisma/schema.prisma
    exit_code=$?
    set -e

    if [[ "${exit_code}" -eq 0 ]]; then
      return 0
    fi

    echo "prisma db push failed with exit code ${exit_code}"
    log_host_resources
    $compose_cmd -f infra/docker-compose.yml -f infra/docker-compose.prod.yml ps || true
    $compose_cmd -f infra/docker-compose.yml -f infra/docker-compose.prod.yml logs --tail=80 api || true

    if [[ "${attempt}" -lt "${max_attempts}" ]]; then
      echo "Waiting before retry"
      sleep $((attempt * 15))
    fi
  done

  return "${exit_code}"
}

compose_stack() {
  local compose_cmd="$1"
  shift
  $compose_cmd -f infra/docker-compose.yml -f infra/docker-compose.prod.yml "$@"
}

maybe_sudo() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

render_template() {
  local input="$1"
  local output="$2"
  sed \
    -e "s#__APP_DOMAIN__#${APP_DOMAIN}#g" \
    -e "s#__API_HOST_PORT__#${API_HOST_PORT}#g" \
    -e "s#__WEB_HOST_PORT__#${WEB_HOST_PORT}#g" \
    "$input" > "$output"
}

existing_certbot_account() {
  compgen -G "/etc/letsencrypt/accounts/acme-v02.api.letsencrypt.org/directory/*" >/dev/null
}

API_HOST_PORT="${API_HOST_PORT:-4000}"
WEB_HOST_PORT="${WEB_HOST_PORT:-13100}"
POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-15432}"
REDIS_HOST_PORT="${REDIS_HOST_PORT:-16379}"
SMTP_HOST_PORT="${SMTP_HOST_PORT:-11025}"
MAILPIT_WEB_PORT="${MAILPIT_WEB_PORT:-18025}"
MINIO_API_PORT="${MINIO_API_PORT:-19000}"
MINIO_CONSOLE_PORT="${MINIO_CONSOLE_PORT:-19001}"
export API_HOST_PORT WEB_HOST_PORT POSTGRES_HOST_PORT REDIS_HOST_PORT SMTP_HOST_PORT MAILPIT_WEB_PORT MINIO_API_PORT MINIO_CONSOLE_PORT

EMAIL_DELIVERY_MODE="${EMAIL_DELIVERY_MODE:-debug}"
EMAIL_APP_NAME="${EMAIL_APP_NAME:-AITRPG}"
EMAIL_FROM="${EMAIL_FROM:-AITRPG <login@${APP_DOMAIN}>}"
RESEND_API_KEY="${RESEND_API_KEY:-}"
SMTP_HOST="${SMTP_HOST:-mailpit}"
SMTP_PORT="${SMTP_PORT:-1025}"
SMTP_SECURE="${SMTP_SECURE:-false}"

maybe_sudo mkdir -p /var/www/certbot
maybe_sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

cat > "${DEPLOY_TARGET_DIR}/.env.production" <<EOF
NODE_ENV=production
APP_URL=https://${APP_DOMAIN}
API_URL=http://127.0.0.1:${API_HOST_PORT}
NEXT_PUBLIC_API_URL=/api

API_HOST_PORT=${API_HOST_PORT}
WEB_HOST_PORT=${WEB_HOST_PORT}
POSTGRES_HOST_PORT=${POSTGRES_HOST_PORT}
REDIS_HOST_PORT=${REDIS_HOST_PORT}
SMTP_HOST_PORT=${SMTP_HOST_PORT}
MAILPIT_WEB_PORT=${MAILPIT_WEB_PORT}
MINIO_API_PORT=${MINIO_API_PORT}
MINIO_CONSOLE_PORT=${MINIO_CONSOLE_PORT}

DATABASE_URL=postgresql://aitrpg:aitrpg@postgres:5432/aitrpg
REDIS_URL=redis://redis:6379

JWT_SECRET=${JWT_SECRET}
EMAIL_DELIVERY_MODE=${EMAIL_DELIVERY_MODE}
EMAIL_APP_NAME=${EMAIL_APP_NAME}
EMAIL_FROM=${EMAIL_FROM}
RESEND_API_KEY=${RESEND_API_KEY}
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_SECURE=${SMTP_SECURE}
SMTP_USER=
SMTP_PASS=

OPENAI_BASE_URL=${OPENAI_BASE_URL}
OPENAI_API_KEY=${OPENAI_API_KEY}
OPENAI_TEXT_MODEL=${OPENAI_TEXT_MODEL}
OPENAI_IMAGE_MODEL=${OPENAI_IMAGE_MODEL}
OPENAI_VIDEO_MODEL=${OPENAI_VIDEO_MODEL}

S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=aitrpg-assets
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
EOF

ln -sfn .env.production "${DEPLOY_TARGET_DIR}/.env"

render_template \
  "${DEPLOY_TARGET_DIR}/infra/nginx/aitrpg.http.conf.template" \
  "/tmp/${APP_DOMAIN}.http.conf"

maybe_sudo cp "/tmp/${APP_DOMAIN}.http.conf" "/etc/nginx/sites-available/${APP_DOMAIN}"
maybe_sudo ln -sf "/etc/nginx/sites-available/${APP_DOMAIN}" "/etc/nginx/sites-enabled/${APP_DOMAIN}"
maybe_sudo nginx -t
maybe_sudo systemctl reload nginx

if [[ ! -d "/etc/letsencrypt/live/${APP_DOMAIN}" ]]; then
  certbot_args=(
    certonly
    --webroot
    -w /var/www/certbot
    -d "${APP_DOMAIN}"
    --agree-tos
    --non-interactive
  )

  if [[ -n "${LETSENCRYPT_EMAIL:-}" ]]; then
    certbot_args+=(--email "${LETSENCRYPT_EMAIL}")
  elif ! existing_certbot_account; then
    certbot_args+=(--register-unsafely-without-email)
  fi

  maybe_sudo certbot "${certbot_args[@]}"
fi

render_template \
  "${DEPLOY_TARGET_DIR}/infra/nginx/aitrpg.https.conf.template" \
  "/tmp/${APP_DOMAIN}.https.conf"

maybe_sudo cp "/tmp/${APP_DOMAIN}.https.conf" "/etc/nginx/sites-available/${APP_DOMAIN}"
maybe_sudo nginx -t
maybe_sudo systemctl reload nginx

cd "${DEPLOY_TARGET_DIR}"
COMPOSE_CMD="$(compose_cmd)"
log_host_resources
compose_stack "${COMPOSE_CMD}" build api web
compose_stack "${COMPOSE_CMD}" up -d postgres redis mailpit minio
echo "Waiting for infrastructure services before schema sync"
sleep 10
run_db_push_with_retry "${COMPOSE_CMD}" 5
compose_stack "${COMPOSE_CMD}" up -d api web
