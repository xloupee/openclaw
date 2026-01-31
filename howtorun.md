# Running the Gateway

## Start (background, survives terminal disconnect)

```bash
pnpm moltbot gateway stop
nohup pnpm start gateway --force > /tmp/moltbot-gateway.log 2>&1 &
disown
```

## Check if running

```bash
pgrep -f "moltbot.*gateway" && echo "Running" || echo "Not running"
```

## View logs

```bash
tail -f /tmp/moltbot-gateway.log
```

## Stop

```bash
pnpm moltbot gateway stop
```
