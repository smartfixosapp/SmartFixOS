#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <app_id> [app_dir]"
    exit 1
fi

# Variables
# Input variable
APP_ID="$1"
APP_DIR="$2"

# Derived variables
SUBDOMAIN="${APP_ID}.ownmy.app"
SERVERDOMAIN="api${APP_ID}.ownmy.app"
DOMAIN="ownmy.app"
SUPA_SUBDOMAIN="supa${APP_ID}.ownmy.app"
APPWRITE_SUBDOMAIN="appwrite${APP_ID}.ownmy.app"
DEV_MODE="dev"
DEV_MODE="dev"

# Appwrite port (docker compose for app may expose 8001:80 to avoid conflict with nginx)
APPWRITE_PORT="${APPWRITE_PORT:-9080}"

HASH_CONF="/etc/nginx/conf.d/server_names_hash.conf"
if [ ! -f "$HASH_CONF" ]; then
  echo "server_names_hash_bucket_size 128;" | sudo tee "$HASH_CONF" >/dev/null
fi


# Configure Nginx for the subdomain
NGINX_CONFIG="/etc/nginx/sites-available/default"
echo "Configuring Nginx for the subdomain..."
sudo bash -c "cat > $NGINX_CONFIG" <<EOL
map \$http_upgrade \$connection_upgrade {
  default upgrade;
  ''      close;
}
# Upstream configuration for connection pooling
upstream functions_backend {
    server 127.0.0.1:8686;
    keepalive 32;
    keepalive_requests 100;
    keepalive_timeout 60s;
}

upstream frontend_dev {
    server 127.0.0.1:5173;
    keepalive 16;
}

upstream supabase_backend {
    server 127.0.0.1:8000;
    keepalive 32;
}

server {
    listen 80;
    server_name $SUBDOMAIN $SERVERDOMAIN $SUPA_SUBDOMAIN $APPWRITE_SUBDOMAIN;
    location / {
        return 301 https://\$host\$request_uri;
    }
}
server {
    listen 443 ssl;
    server_name $SUBDOMAIN;
    ssl_certificate $APP_DIR/fullchain.pem;
    ssl_certificate_key $APP_DIR/privkey.pem;
    client_max_body_size 300M;
    
    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
    gzip_comp_level 6;
    gzip_proxied any;
    
    location /api/functions/ {
        proxy_pass http://functions_backend/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 30s;
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        
        # Cache static responses (adjust as needed)
        proxy_cache_bypass \$http_upgrade;
        add_header X-Cache-Status \$upstream_cache_status;
    }
    location / {
        proxy_pass http://frontend_dev;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        client_max_body_size 300M;
    }
}

server {
    listen 443 ssl;
    server_name $SERVERDOMAIN;
    ssl_certificate $APP_DIR/fullchain.pem;
    ssl_certificate_key $APP_DIR/privkey.pem;
    client_max_body_size 300M;
    
    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml;
    gzip_comp_level 6;
    gzip_proxied any;
    
    location / {
        proxy_pass http://functions_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 30s;
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        client_max_body_size 300M;
    }
}

server {
    listen 443 ssl;
    server_name $SUPA_SUBDOMAIN;
    set \$supabase_upstream http://supabase_backend;
    ssl_certificate $APP_DIR/fullchain.pem;
    ssl_certificate_key $APP_DIR/privkey.pem;
    client_max_body_size 300M;
    
    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript;
    gzip_comp_level 6;
    gzip_proxied any;
    
    location / {
        proxy_pass http://supabase_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 30s;
        proxy_connect_timeout 5s;
        client_max_body_size 300M;
    }
    location /functions/v1/ {
        proxy_pass http://functions_backend/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /realtime/v1/websocket {
    proxy_pass \$supabase_upstream;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
  }
}

server {
    listen 443 ssl;
    server_name $APPWRITE_SUBDOMAIN;
    ssl_certificate $APP_DIR/fullchain.pem;
    ssl_certificate_key $APP_DIR/privkey.pem;
    client_max_body_size 300M;
    location / {
        proxy_pass http://127.0.0.1:$APPWRITE_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 300M;
    }
}
EOL

# Enable the Nginx configuration
echo "Enabling Nginx configuration..."
sudo nginx -t

# Restart Nginx
echo "Restarting Nginx server..."
sudo systemctl restart nginx
