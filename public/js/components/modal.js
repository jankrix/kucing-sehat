export function showModal(title, contentHtml, onSubmit) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-title">${title}</div>
      <div class="modal-body">${contentHtml}</div>
      <div class="modal-actions">
        <button class="btn" data-action="cancel">Batal</button>
        <button class="btn-primary" data-action="submit">Simpan</button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.dataset.action === 'cancel') {
      overlay.remove();
    }
    if (e.target.dataset.action === 'submit') {
      const formData = {};
      overlay.querySelectorAll('[data-field]').forEach(el => {
        formData[el.dataset.field] = el.value;
      });
      if (onSubmit) onSubmit(formData, overlay);
    }
  });

  document.body.appendChild(overlay);
  return overlay;
}

export function closeModal(overlay) {
  if (overlay) overlay.remove();
}
