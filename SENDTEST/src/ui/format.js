export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(sec) {
  if (!isFinite(sec) || sec < 0) return '-';
  if (sec < 60) return `${Math.ceil(sec)}초`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}분 ${s}초`;
}

export function iconForMime(mime) {
  if (!mime) return '📄';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime === 'application/pdf') return '📕';
  if (mime.includes('zip')) return '🗜️';
  return '📄';
}

// Wires a `.segmented` container (buttons with data-value) so exactly one carries
// `.active` at a time, and returns {getValue, setValue}.
export function setupSegmented(container, onChange) {
  const buttons = Array.from(container.querySelectorAll('.segmented-btn'));
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (onChange) onChange(btn.dataset.value);
    });
  });
  return {
    getValue: () => (buttons.find((b) => b.classList.contains('active')) || buttons[0]).dataset.value,
    setValue: (value) => buttons.forEach((b) => b.classList.toggle('active', b.dataset.value === value)),
  };
}
