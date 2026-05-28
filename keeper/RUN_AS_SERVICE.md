# Running the Zield Keeper in Production

This guide covers production-grade ways to run the TypeScript keeper reliably 24/7.

## Recommended Options (Ranked)

| Option | Best For | Complexity | Recommendation |
|--------|----------|------------|----------------|
| **Docker + docker-compose** | Most teams | Low | **Preferred for most deployments** |
| **PM2** | Node.js-heavy environments | Low-Medium | Good if you already use PM2 |
| **systemd** | Bare metal / simple VPS | Medium | Good for minimal setups |
| **Kubernetes** | Large scale | High | Overkill for most Zield deployments |

---

## 1. Docker (Recommended)

### Quick Start

```bash
cd keeper

# 1. Create your environment file
cp .env.example .env
# Edit .env and set at minimum:
# VAULT_ADDRESS=0x...
# KEEPER_PRIVATE_KEY=0x...
# BASE_MAINNET_RPC=...

# 2. Build and run
docker compose up -d --build

# 3. Check logs
docker compose logs -f zield-keeper

# 4. Health check
curl http://localhost:3001/health
```

### Production Tips

- Use a reverse proxy (nginx / caddy) in front of the health endpoint if exposing it.
- Mount logs to persistent storage.
- Consider adding a restart policy and resource limits in production `docker-compose.override.yml`.

---

## 2. PM2 (Good for Node.js Shops)

We include an `ecosystem.config.js` for PM2.

```bash
cd keeper

# Install PM2 globally if needed
npm install -g pm2

# Start the keeper
pm2 start ecosystem.config.js

# Save the process list
pm2 save

# Set up PM2 to start on system boot
pm2 startup
```

Useful commands:
- `pm2 logs zield-keeper`
- `pm2 restart zield-keeper`
- `pm2 monit`

---

## 3. systemd (Bare Metal / Simple VPS)

Create a service file:

```bash
sudo tee /etc/systemd/system/zield-keeper.service > /dev/null <<EOF
[Unit]
Description=Zield Risk-Aware Keeper
After=network.target

[Service]
Type=simple
User=zield
WorkingDirectory=/opt/zield/keeper
Environment=NODE_ENV=production
EnvironmentFile=/opt/zield/keeper/.env
ExecStart=/usr/bin/node --loader tsx/esm src/index.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=zield-keeper

[Install]
WantedBy=multi-user.target
EOF
```

Then enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable zield-keeper
sudo systemctl start zield-keeper

# Check status
sudo systemctl status zield-keeper
sudo journalctl -u zield-keeper -f
```

---

## Environment Variables (Important)

Minimum required for production:

```env
BASE_MAINNET_RPC=https://your-rpc-provider.com
VAULT_ADDRESS=0xYourVaultAddress
KEEPER_PRIVATE_KEY=0xYourPrivateKey          # Keep this secret!
HEALTH_PORT=3001
```

Recommended additions for production:
- `ALERT_WEBHOOK_URL` (for future alerting)
- Proper logging level / structured logs

---

## Monitoring & Health

The keeper exposes:

- **Health check**: `GET /health` → returns status, uptime, version
- **Basic metrics**: `GET /metrics` → uptime + memory usage
- **Webhook alerting**: Automatically sends alerts on important events when `ALERT_WEBHOOK_URL` is set in the environment (supports Discord/Slack-style webhooks).

Configure alerting by setting:

```env
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Alerts are sent for:
- Successful rebalance execution
- Blocked rebalances (preflight failures)
- Transaction failures
- High gas cost warnings

You can integrate the health endpoint with:
- Docker healthchecks (already configured)
- Uptime monitors
- Your internal monitoring stack

Future improvements:
- Prometheus metrics endpoint with real counters
- More granular alerting (e.g., large profit/loss, repeated blocks)

---

## Security Notes

- Never commit your `.env` file.
- The private key should have minimal permissions (only the funds needed for gas).
- Consider running the container as a non-root user (already done in the Dockerfile).
- Use secrets management (Docker secrets, Kubernetes secrets, AWS Secrets Manager, etc.) in real production environments.

---

## Next Steps / Roadmap

- Add real Prometheus metrics
- Add webhook alerting on critical events
- Add structured logging (Pino) with proper levels
- Support for multiple vaults from one keeper instance

For now, the combination of Docker + the health endpoint gives you a solid, maintainable production setup.