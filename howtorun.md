# Running the Gateway

## 1. Kill existing processes

```bash
pkill -9 -f "openclaw-gateway" 2>/dev/null || true
pkill -9 -f "openclaw" 2>/dev/null || true
```

## 2. Build (if needed)

```bash
pnpm build
```

## 3. Start (background, survives terminal disconnect)

```bash
nohup pnpm start gateway --force > /tmp/moltbot-gateway.log 2>&1 &
disown
```

## 4. Check if running

```bash
pgrep -af "openclaw-gateway"
```

Or check the port:

```bash
ss -ltnp | grep 18789
```

## View logs

```bash
tail -f /tmp/moltbot-gateway.log
```

## Stop

```bash
pkill -9 -f "openclaw-gateway"
```

## iMessage Setup (requires Mac)

iMessage requires a Mac with Messages.app signed in. The gateway connects via SSH.

### On your Mac:

1. **Install imsg CLI:**
```bash
brew install steipete/tap/imsg
```

2. **Grant Full Disk Access** to Terminal (System Settings → Privacy & Security → Full Disk Access)

3. **Enable Remote Login** (System Settings → General → Sharing → Remote Login → On)

4. **Install Tailscale** and sign in (for remote access)

5. **Test imsg works:**
```bash
imsg chats --limit 5
```

### On Ubuntu server:

1. **Install Tailscale:**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

2. **Generate SSH key (if needed):**
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" -C "moltbot-ubuntu"
cat ~/.ssh/id_ed25519.pub
```

3. **Add the public key to Mac** (run on Mac):
```bash
echo "YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

4. **Configure SSH multiplexing** (speeds up connections):
```bash
mkdir -p ~/.ssh/sockets
cat >> ~/.ssh/config << 'EOF'

Host YOUR_MAC_TAILSCALE_IP
  ControlMaster auto
  ControlPath ~/.ssh/sockets/%r@%h-%p
  ControlPersist 600
EOF
```

5. **Establish SSH control master:**
```bash
ssh -o ControlMaster=yes -o ControlPath=~/.ssh/sockets/%r@%h-%p -o ControlPersist=600 -N -f YOUR_USER@YOUR_MAC_TAILSCALE_IP
```

6. **Create wrapper script:**
```bash
mkdir -p ~/.openclaw/scripts
cat > ~/.openclaw/scripts/imsg-ssh << 'EOF'
#!/usr/bin/env bash
exec ssh -o BatchMode=yes -o StrictHostKeyChecking=no YOUR_USER@YOUR_MAC_TAILSCALE_IP /opt/homebrew/bin/imsg "$@"
EOF
chmod +x ~/.openclaw/scripts/imsg-ssh
```

7. **Add to config** (`~/.openclaw/openclaw.json`):
```json
"channels": {
  "imessage": {
    "enabled": true,
    "cliPath": "/root/.openclaw/scripts/imsg-ssh",
    "remoteHost": "YOUR_USER@YOUR_MAC_TAILSCALE_IP",
    "service": "auto",
    "dmPolicy": "allowlist",
    "allowFrom": ["+1234567890"],
    "groupPolicy": "disabled"
  }
}
```

And enable the plugin:
```json
"plugins": {
  "entries": {
    "imessage": {
      "enabled": true
    }
  }
}
```

8. **Restart gateway** and check status:
```bash
pnpm openclaw channels status --probe
```

## Check context window usage

```bash
cat ~/.openclaw/agents/main/sessions/sessions.json | jq '.["agent:main:main"] | {inputTokens, outputTokens, totalTokens, contextTokens, model}'
```

## Troubleshooting

If startup fails, check logs:

```bash
tail -50 /tmp/moltbot-gateway.log
```

List all running processes:

```bash
ps aux | grep -E "openclaw|gateway" | grep -v grep
```
