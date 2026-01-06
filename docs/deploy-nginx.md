# Deploy Captive Portal with NGINX

## Prerequisites
- Linux gateway device with Wi-Fi AP (hostapd) and DNS (dnsmasq)
- Node.js runtime for the backend
- NGINX installed

## Install NGINX
```bash
sudo apt update
sudo apt install -y nginx
```

## Configure NGINX reverse proxy
```bash
sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
sudo cp deployment/nginx/captive-portal.conf /etc/nginx/sites-available/captive-portal.conf
sudo ln -sf /etc/nginx/sites-available/captive-portal.conf /etc/nginx/sites-enabled/captive-portal.conf
sudo nginx -t
sudo systemctl reload nginx
```

## Run the backend
```bash
# from repo root
CAPTIVE_FORCE_REDIRECT=true PORT=3001 NODE_ENV=production npm start
```

## Verify probes
```bash
curl -I http://localhost/generate_204
curl -I http://localhost/hotspot-detect.html
curl -I http://localhost/ncsi.txt
```
Expect `302 Found` with `Location: /portal`.

## Ensure DNS pin to gateway
- dnsmasq must resolve all domains to the gateway IP
- Confirm `address=/#/<gateway_ip>` in dnsmasq config
- Restart dnsmasq:
```bash
sudo systemctl restart dnsmasq
```

## Checklist
- NGINX listening on :80
- Backend running on :3001
- Probes return 302 to /portal
- Clients get captive portal popup on connect
