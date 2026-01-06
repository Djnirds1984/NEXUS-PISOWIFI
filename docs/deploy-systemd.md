# Run NEXUS PISOWIFI as a systemd service

## Install service
```bash
sudo cp deployment/systemd/nexus-pisowifi.service /etc/systemd/system/nexus-pisowifi.service
sudo systemctl daemon-reload
sudo systemctl enable nexus-pisowifi
sudo systemctl start nexus-pisowifi
```

## Status and logs
```bash
sudo systemctl status nexus-pisowifi
sudo journalctl -u nexus-pisowifi -f
```

## Troubleshooting
- Exit code 217/USER: the configured User does not exist. Set `User=root` or change `WorkingDirectory` and `User` to a valid user.
- Ensure paths are correct:
  - WorkingDirectory: `/root/NEXUS-PISOWIFI` or your repo path
  - ExecStart: `/usr/bin/npm run start:portal`
- Ensure Node/npm available in PATH:
  - Environment: `PATH=/usr/local/bin:/usr/bin`
- NGINX must listen on `:80` to trigger captive portal probes:
  - See docs/deploy-nginx.md

## Environment used by service
- NODE_ENV=production
- PORT=3001
- CAPTIVE_FORCE_REDIRECT=true
