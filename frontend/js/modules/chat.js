window.updateChatContextBar = function() {
  const bar = document.getElementById('composeContextBar');
  if (!bar) return;
  
  let html = '';
  let count = 0;
  
  // Collect from scopes
  if (typeof _checkedDocs !== 'undefined') {
    _checkedDocs.forEach(path => {
      const name = path.split('/').pop();
      html += `<span class="context-badge"><i class="fas fa-file-alt"></i> ${name}</span>`;
      count++;
    });
  }
  
  if (html) {
    bar.innerHTML = html;
    bar.style.display = 'flex';
  } else {
    bar.style.display = 'none';
  }
};
