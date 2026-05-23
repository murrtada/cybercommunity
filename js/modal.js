function showModal(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
  return new Promise((resolve) => {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-title">${escapeHtml(title)}</div>
        <div class="modal-message">${escapeHtml(message)}</div>
        <div class="modal-actions">
          <button class="modal-btn modal-btn-cancel" id="modal-cancel">${escapeHtml(cancelText)}</button>
          <button class="modal-btn modal-btn-confirm" id="modal-confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('open'));

    overlay.querySelector('#modal-cancel').addEventListener('click', () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 250);
      resolve(false);
    });

    overlay.querySelector('#modal-confirm').addEventListener('click', () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 250);
      resolve(true);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 250);
        resolve(false);
      }
    });
  });
}
