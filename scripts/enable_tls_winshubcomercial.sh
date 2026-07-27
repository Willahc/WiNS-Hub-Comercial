#!/bin/bash
set -euo pipefail
TARGET=2.25.162.199
DOM=winshubcomercial.com.br
A=$(dig +short "$DOM" A @8.8.8.8 | head -1 | tr -d '[:space:]')
echo "resolved_A=$A expected=$TARGET"
if [ "$A" != "$TARGET" ]; then
  echo "ABORT: DNS not pointing to major VPS"
  exit 3
fi
apt-get install -y certbot 2>/dev/null || true
certbot certonly --webroot -w /var/www/certbot \
  -d winshubcomercial.com.br -d www.winshubcomercial.com.br \
  --agree-tos --non-interactive -m ops@winshubagro.cloud --deploy-hook 'systemctl reload nginx' || \
certbot certonly --webroot -w /var/www/certbot \
  -d winshubcomercial.com.br \
  --agree-tos --non-interactive -m ops@winshubagro.cloud

# Write full HTTPS conf
cat > /etc/nginx/sites-available/winshubcomercial.com.br.conf <<'NGINX'
limit_req_zone $binary_remote_addr zone=hub_api:10m rate=20r/s;
limit_req_zone $binary_remote_addr zone=hub_gen:10m rate=30r/s;
upstream hub_agro_api   { server 127.0.0.1:18083; keepalive 16; }
upstream hub_saude_api  { server 127.0.0.1:18080; keepalive 8; }
upstream hub_engenharia { server 127.0.0.1:18081; keepalive 8; }
upstream hub_log_api    { server 127.0.0.1:18082; keepalive 8; }

server {
    listen 80;
    listen [::]:80;
    server_name winshubcomercial.com.br www.winshubcomercial.com.br;
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; default_type text/plain; }
    location / { return 301 https://winshubcomercial.com.br$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.winshubcomercial.com.br;
    ssl_certificate     /etc/letsencrypt/live/winshubcomercial.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/winshubcomercial.com.br/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    return 301 https://winshubcomercial.com.br$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name winshubcomercial.com.br;
    ssl_certificate     /etc/letsencrypt/live/winshubcomercial.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/winshubcomercial.com.br/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    access_log /var/log/nginx/winshubcomercial_access.log;
    error_log  /var/log/nginx/winshubcomercial_error.log;
    server_tokens off;
    client_max_body_size 12m;
    # HSTS only after validated HTTPS
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location ~* (\.env|\.git|\.sql|\.dump|\.gpg|Dockerfile|requirements\.txt|\.bak) { return 404; }
    location ~ /\. { return 404; }
    location ^~ /caminhao-vazio { return 404; }
    location ^~ /comercial { return 404; }
    location ^~ /cliente-inteligente { return 404; }

    location = /saude { return 301 /saude/; }
    location = /saude/login.html { return 404; }
    location = /saude/login { return 404; }
    location ^~ /saude/ {
        limit_req zone=hub_api burst=40 nodelay;
        auth_basic "WiNS Hub Saude";
        auth_basic_user_file /etc/nginx/.htpasswd_saude;
        rewrite ^/saude/(.*)$ /$1 break;
        proxy_pass http://hub_saude_api;
        include /etc/nginx/snippets/wins-saude-proxy-headers.conf;
        proxy_set_header X-Forwarded-Prefix /saude;
        proxy_set_header X-Script-Name /saude;
        proxy_set_header X-Forwarded-Proto https;
    }
    location = /agro { return 301 /agro/; }
    location ^~ /agro/ {
        limit_req zone=hub_api burst=40 nodelay;
        rewrite ^/agro/(.*)$ /$1 break;
        proxy_pass http://hub_agro_api;
        include /etc/nginx/snippets/wins-saude-proxy-headers.conf;
        proxy_set_header X-Forwarded-Prefix /agro;
        proxy_set_header X-Forwarded-Proto https;
    }
    location = /engenharia { return 301 /engenharia/; }
    location ^~ /engenharia/ {
        limit_req zone=hub_api burst=40 nodelay;
        rewrite ^/engenharia/(.*)$ /$1 break;
        proxy_pass http://hub_engenharia;
        include /etc/nginx/snippets/wins-saude-proxy-headers.conf;
        proxy_set_header X-Forwarded-Prefix /engenharia;
        proxy_set_header X-Script-Name /engenharia;
        proxy_set_header X-Forwarded-Proto https;
        add_header Cache-Control "no-store" always;
    }
    location = /log { return 301 /log/; }
    location ^~ /log/ {
        limit_req zone=hub_api burst=40 nodelay;
        rewrite ^/log/(.*)$ /$1 break;
        proxy_pass http://hub_log_api;
        include /etc/nginx/snippets/wins-saude-proxy-headers.conf;
        proxy_set_header X-Forwarded-Prefix /log;
        proxy_set_header X-Script-Name /log;
        proxy_set_header X-Forwarded-Proto https;
        add_header Cache-Control "no-store" always;
    }
    location = / {
        root /opt/winshub/shell;
        try_files /index.html =404;
        add_header Cache-Control "no-store" always;
    }
    location / {
        root /opt/winshub/shell;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store" always;
    }
}
NGINX
nginx -t && systemctl reload nginx
echo TLS_OK
