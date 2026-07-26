#!/usr/bin/env bash
set -euo pipefail

# runpod-enable-ide.sh
#
# Prints the commands you need to run in the RunPod web terminal
# to enable IDE Remote SSH access (VS Code, cursor, etc.)
#
# Usage: ./runpod-enable-ide.sh
#
# Then paste the printed commands into the RunPod web terminal.

SSH_KEY="${HOME}/.ssh/id_ed25519"
SSH_KEY_PUB="${SSH_KEY}.pub"

if [[ ! -f "$SSH_KEY_PUB" ]]; then
    echo "Error: public key not found at $SSH_KEY_PUB"
    echo "Generate one with: ssh-keygen -t ed25519 -C \"your@email.com\""
    exit 1
fi

PUBKEY="$(cat "$SSH_KEY_PUB")"

echo "============================================================"
echo "RunPod IDE Remote SSH Setup"
echo "============================================================"
echo ""
echo "Step 1 — Load your SSH key into the local agent:"
echo ""
echo "    ssh-add $SSH_KEY"
echo ""
echo "Step 2 — Paste this into the RunPod web terminal:"
echo ""
echo "============================================================"
echo ""

cat <<TERMINAL
mkdir -p ~/.ssh && chmod 700 ~/.ssh
printf '%s\n' "${PUBKEY}" > ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
service ssh restart 2>/dev/null || /etc/init.d/ssh restart 2>/dev/null

TERMINAL

echo "============================================================"
echo ""
echo "Step 3 — Connect from this machine:"
echo ""
echo "    ssh root@<RUNPOD_IP> -p <RUNPOD_PORT> -i $SSH_KEY"
echo ""
