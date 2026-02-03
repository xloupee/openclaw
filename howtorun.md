# Running the Gateway

## 1. Kill existing processes

```bash
pkill -9 -f "openclaw-gateway" 2>/dev/null || true
pkill -9 -f "openclaw" 2>/dev/null || true
pkill -f "proactive-reset" 2>/dev/null || true
```

## 2. Build (if needed)

```bash
pnpm build
```

## 3. Start (background, survives terminal disconnect)

```bash
# Start gateway
nohup pnpm start gateway --force > /tmp/moltbot-gateway.log 2>&1 &
disown

# Wait for gateway to be ready, then start proactive reset monitor
sleep 5
nohup npx tsx scripts/proactive-reset.ts > /tmp/proactive-reset.log 2>&1 &
disown
```

The proactive reset monitor reads `session.proactiveResetMinutes` from `~/.openclaw/openclaw.json`.
Default is 1 minute. Change it in the config file to adjust.

## 4. Check if running

```bash
pgrep -af "openclaw-gateway"
pgrep -af "proactive-reset"
```

Or check the port:

```bash
ss -ltnp | grep 18789
```

## View logs

```bash
# Gateway logs
tail -f /tmp/moltbot-gateway.log

# Proactive reset logs
tail -f /tmp/proactive-reset.log
```

## Stop

```bash
pkill -9 -f "openclaw-gateway"
pkill -f "proactive-reset"
```

## iMessage (run on Mac after opening)

```bash
ssh -o ControlMaster=yes -o ControlPath=~/.ssh/sockets/%r@%h-%p -o ControlPersist=600 -N -f kennethjiang@100.102.104.89
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

 Updated /root/.openclaw/workspace/SOUL.md (the one the bot actually uses).