export function formatDesktopDocNumber({ prefix, type, seq }) {
  return `${prefix}-${type}-${seq}`;
}

export function nextSeq(lastIssued) {
  return Number(lastIssued || 0) + 1;
}
