# SSL Certificates

Place your SSL certificate files here:

- `fullchain.pem` — Full certificate chain (certificate + intermediates)
- `privkey.pem` — Private key

## Provisioning with Certbot (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot

# Obtain certificate (stop nginx first if running on port 80)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy to this directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./fullchain.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./privkey.pem
sudo chmod 644 ./fullchain.pem ./privkey.pem
```

## Auto-renewal

```bash
# Add to crontab for auto-renewal
0 0 * * * certbot renew --quiet && docker compose -f docker/docker-compose.yml exec nginx nginx -s reload
```

## Self-signed (development only)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem -out fullchain.pem \
  -subj "/CN=localhost"
```

> **Security:** Never commit certificate files or private keys to git.
> These files are excluded via `.gitignore`.
