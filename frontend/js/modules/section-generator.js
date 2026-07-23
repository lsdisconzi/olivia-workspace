/* ═══════════════════════════════════════════════════════════════════
   section-generator.js — Dynamic workspace section generator
   Allows users to generate new sidebar sections via the UI.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    // ── API endpoint ───────────────────────────────────────────────────────
    function apiGenerateSection(spec) {
        return apiPost('/api/skills/generate-section', { spec: spec });
    }

    // ── Modal UI ───────────────────────────────────────────────────────
    function buildModal() {
        var existing = document.getElementById('sectionGenModal');
        if (existing) return existing;

        var modal = document.createElement('div');
        modal.id = 'sectionGenModal';
        modal.className = 'modal-backdrop';
        modal.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;align-items:center;justify-content:center;';
        modal.innerHTML =
            '<div class="modal-window" style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r);padding:0;max-width:480px;width:90%;box-shadow:var(--shadow-lg);">' +
            '<div class="modal-header" style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">' +
            '<h3 class="modal-title" style="margin:0;font-family:var(--serif);font-size:16px;color:var(--white);">Gerar Nova Seção</h3>' +
            '<button class="btn btn-sm" onclick="sectionGenCloseModal()" title="Fechar"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '<div class="modal-body" style="padding:16px;">' +
            '<form id="sectionGenForm">' +
            '<div style="margin-bottom:12px;">' +
            '<label style="display:block;margin-bottom:4px;color:var(--gray-hi);font-size:12px;">ID da seção (único, sem espaços)</label>' +
            '<input type="text" id="sectionGenId" name="id" required style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--r);font-size:13px;">' +
            '</div>' +
            '<div style="margin-bottom:12px;">' +
            '<label style="display:block;margin-bottom:4px;color:var(--gray-hi);font-size:12px;">Rótulo (nome na barra)</label>' +
            '<input type="text" id="sectionGenLabel" name="label" required style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--r);font-size:13px;">' +
            '</div>' +
            '<div style="margin-bottom:12px;">' +
            '<label style="display:block;margin-bottom:4px;color:var(--gray-hi);font-size:12px;">Ícone (Font Awesome)</label>' +
            '<input type="text" id="sectionGenIcon" name="icon" value="fa-cube" required style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--r);font-size:13px;">' +
            '</div>' +
            '<div style="margin-bottom:12px;">' +
            '<label style="display:block;margin-bottom:4px;color:var(--gray-hi);font-size:12px;">Descrição curta</label>' +
            '<input type="text" id="sectionGenDesc" name="description" value="Nova seção" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--r);font-size:13px;">' +
            '</div>' +
            '<div style="margin-bottom:12px;">' +
            '<label style="display:block;margin-bottom:4px;color:var(--gray-hi);font-size:12px;">Cor de destaque (hex)</label>' +
            '<input type="text" id="sectionGenAccent" name="accentColor" value="#3b82f6" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--r);font-size:13px;">' +
            '</div>' +
            '</form>' +
            '</div>' +
            '<div class="modal-footer" style="padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;">' +
            '<button class="btn btn-sm" onclick="sectionGenCloseModal()">Cancelar</button>' +
            '<button class="btn btn-primary btn-sm" onclick="sectionGenSubmit()">Gerar</button>' +
            '</div>' +
            '</div>';
        document.body.appendChild(modal);
        return modal;
    }

    // ── Event handlers ───────────────────────────────────────────────────
    window.sectionGenOpenModal = function() {
        var modal = buildModal();
        modal.style.display = 'flex';
        var form = document.getElementById('sectionGenForm');
        if (form) form.reset();
    };

    window.sectionGenCloseModal = function() {
        var modal = document.getElementById('sectionGenModal');
        if (modal) modal.style.display = 'none';
    };

    window.sectionGenSubmit = function() {
        var form = document.getElementById('sectionGenForm');
        if (!form) return;

        var id = document.getElementById('sectionGenId').value.trim();
        var label = document.getElementById('sectionGenLabel').value.trim();
        var icon = document.getElementById('sectionGenIcon').value.trim();
        var desc = document.getElementById('sectionGenDesc').value.trim();
        var accent = document.getElementById('sectionGenAccent').value.trim();

        if (!id || !label || !icon) {
            alert('ID, rótulo e ícone são obrigatórios.');
            return;
        }

        var spec = {
            id: id,
            label: label,
            icon: icon,
            description: desc,
            accentColor: accent,
        };

        apiGenerateSection(spec)
            .then(function(resp) {
                if (resp.error) {
                    alert('Erro: ' + resp.error);
                    return;
                }
                alert('Seção "' + id + '" gerada com sucesso!\n\nRecarregando a página...');
                sectionGenCloseModal();
                setTimeout(function() { location.reload(); }, 500);
            })
            .catch(function(err) {
                alert('Falha ao gerar seção: ' + err);
            });
    };

    // ── Export for global access ───────────────────────────────────────
    window.buildSectionGeneratorModal = buildModal;

})();