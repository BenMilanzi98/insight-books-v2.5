#!/usr/bin/env bash
# Ensure swap exists on a low-RAM VPS (needed for any on-box next build).
# Usage: sudo ./scripts/vps-ensure-swap.sh [size_gb]
# Default: 2 GiB swap file at /swapfile
set -euo pipefail

SIZE_GB="${1:-2}"
SWAPFILE="${SWAPFILE_PATH:-/swapfile}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo $0 $*" >&2
  exit 1
fi

if swapon --show | grep -q .; then
  echo "==> Swap already active:"
  swapon --show
  free -h
  exit 0
fi

if [ -f "${SWAPFILE}" ]; then
  echo "==> Enabling existing ${SWAPFILE}"
  chmod 600 "${SWAPFILE}"
  mkswap "${SWAPFILE}"
  swapon "${SWAPFILE}"
else
  echo "==> Creating ${SIZE_GB}G swap at ${SWAPFILE}"
  fallocate -l "${SIZE_GB}G" "${SWAPFILE}" || dd if=/dev/zero of="${SWAPFILE}" bs=1M count=$((SIZE_GB * 1024))
  chmod 600 "${SWAPFILE}"
  mkswap "${SWAPFILE}"
  swapon "${SWAPFILE}"
fi

if ! grep -q "${SWAPFILE}" /etc/fstab; then
  echo "${SWAPFILE} none swap sw 0 0" >> /etc/fstab
fi

# Prefer reclaiming cache before OOM-killing under memory pressure
sysctl -w vm.swappiness=60 >/dev/null
sysctl -w vm.vfs_cache_pressure=50 >/dev/null

echo "==> Swap ready"
swapon --show
free -h
