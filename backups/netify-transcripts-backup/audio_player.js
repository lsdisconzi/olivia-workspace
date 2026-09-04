if (typeof window._noteAt !== 'function') {
    window._noteAt = function (segRef) {
        var seg = document.getElementById('noteSegment');
        var body = document.getElementById('noteBody');
        if (seg) seg.value = segRef;
        if (body) { 
            body.focus(); 
            var panel = document.getElementById('notesPanel');
            if (panel) {
                window.scrollTo({ top: panel.offsetTop - 20, behavior: 'smooth' }); 
            }
        }
    };
}

function _renderNotesList(notes) {
    var list = document.getElementById('notesList');
    var count = document.getElementById('notesCount');
    if (!list) return;
    
    if (count) count.textContent = notes.length;
    
    if (notes.length === 0) {
        list.innerHTML = '<div class="notes-empty">No notes yet. Click ＋ note on any transcript segment to add one.</div>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < notes.length; i++) {
        var n = notes[i];
        var author = (n.author || 'anonymous').replace(/</g, '&lt;');
        var seg = (n.segment || '').replace(/</g, '&lt;');
        var text = (n.text || '').replace(/</g, '&lt;');
        var ts = (n.timestamp || '').replace(/</g, '&lt;');
        var id = (n.id || '').replace(/</g, '&lt;');
        html += '<div class="note-card">' +
            '<div class="note-meta">' +
                '<span class="note-author">' + author + '</span>' +
                '<span class="note-seg">' + seg + '</span>' +
                '<span>' + ts + '</span>' +
            '</div>' +
            '<div class="note-body">' + text + '</div>' +
            '<div class="note-actions">' +
                '<button onclick="window._deleteNote(\'' + id + '\')">✕ Delete</button>' +
            '</div>' +
        '</div>';
    }
    list.innerHTML = html;
}

window._deleteNote = async function(noteId) {
    var stem = document.body.getAttribute('data-audio-stem');
    if (!confirm('Delete this note?')) return;
    try {
        var res = await fetch('/delete_note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stem: stem, id: noteId })
        });
        if (res.ok) {
            await window._refreshNotes();
        } else {
            alert('Failed to delete note.');
        }
    } catch(e) {
        alert('Error deleting note.');
    }
};

window._refreshNotes = async function() {
    var stem = document.body.getAttribute('data-audio-stem');
    try {
        var res = await fetch('/get_notes?stem=' + encodeURIComponent(stem));
        var data = await res.json();
        if (data.ok) {
            _renderNotesList(data.notes);
        }
    } catch(e) {
        console.error('Error loading notes:', e);
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    var stem = document.body.getAttribute('data-audio-stem');
    var mapKey = document.body.getAttribute('data-audio-map-key');
    // Inject karaoke word-highlight styles (shared across all rendered pages)
    if (!document.getElementById('wlHighlightStyle')) {
        var wlStyle = document.createElement('style');
        wlStyle.id = 'wlHighlightStyle';
        wlStyle.textContent =
            '.transcript-segment .seg-text .wl-word{' +
                'border-radius:2px;padding:0 1px;margin:0 -1px;' +
                'transition:background-color .12s ease,color .12s ease;' +
            '}' +
            '.transcript-segment .seg-text .wl-word.active{' +
                'background:#f5d97a;color:#1b1c1e;' +
            '}' +
            '.transcript-segment .seg-text .wl-word.past{' +
                'color:#8a8b87;' +
            '}' +
            '.transcript-segment.is-playing{' +
                'background:rgba(36,64,95,0.05);border-left-color:#c9a84c;' +
            '}';
        document.head.appendChild(wlStyle);
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    
    // Load and render existing notes
    var notesPanel = document.getElementById('notesPanel');
    if (notesPanel) {
        // Ensure notes list container exists
        var notesList = document.getElementById('notesList');
        if (!notesList) {
            var listDiv = document.createElement('div');
            listDiv.id = 'notesList';
            listDiv.className = 'notes-list';
            notesPanel.insertBefore(listDiv, notesPanel.firstChild);
        }
        
        // Ensure count badge exists
        var notesCount = document.getElementById('notesCount');
        if (!notesCount) {
            var countSpan = document.createElement('span');
            countSpan.id = 'notesCount';
            countSpan.className = 'notes-count';
            var head = notesPanel.querySelector('.notes-head');
            if (head) head.appendChild(countSpan);
        }
        
        // Load notes
        await window._refreshNotes();
        
        // Add composer form if not already present
        if (!document.getElementById('noteBody')) {
            var formHtml = 
                '<div style="margin-top: 20px; padding: 15px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 6px;">' +
                    '<h3 style="margin-bottom: 15px; font-family: var(--mono); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent-gold);">Add a Note</h3>' +
                    '<input type="text" id="noteSegment" readonly style="width: 100%; margin-bottom: 10px; background: var(--bg-card); color: var(--text-muted); border: 1px solid var(--border); padding: 8px; border-radius: 4px; font-family: var(--mono); font-size: 0.8rem;" placeholder="Click \'+ note on this segment\' to select">' +
                    '<textarea id="noteBody" style="width: 100%; height: 80px; margin-bottom: 10px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border); padding: 8px; border-radius: 4px; font-family: var(--sans); font-size: 0.88rem;" placeholder="Write your comment here..."></textarea>' +
                    '<button id="saveNoteBtn" style="padding: 8px 16px; background: var(--accent-gold-dim); border: 1px solid rgba(201, 168, 76, 0.3); color: var(--accent-gold); cursor: pointer; border-radius: 4px; font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase;">Save Note</button>' +
                '</div>';
            notesPanel.insertAdjacentHTML('beforeend', formHtml);
            
            document.getElementById('saveNoteBtn').addEventListener('click', async () => {
                var seg = document.getElementById('noteSegment').value;
                var text = document.getElementById('noteBody').value;
                if (!seg || !text) return alert('Please select a segment and write a note.');
                
                try {
                    var res = await fetch('/add_note', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ stem: stem, segment: seg, text: text })
                    });
                    if (res.ok) {
                        document.getElementById('noteBody').value = '';
                        await window._refreshNotes();
                    } else {
                        alert('Failed to save note.');
                    }
                } catch(e) {
                    alert('Error saving note.');
                }
            });
        }
    }

    // Audio player - lazy load to avoid overwhelming the server
    try {
        var audioMap = null;
        var mapUrls = [
            '/case_files/02-transcripts/transcripts_rendered/audio_map.json',
            '../audio_map.json',
            './audio_map.json',
            '/_shared/cases/la8159/02-transcripts/transcripts_rendered/audio_map.json'
        ];
        for (var mIdx = 0; mIdx < mapUrls.length; mIdx++) {
            try {
                var response = await fetch(mapUrls[mIdx]);
                if (response.ok) {
                    var candidate = await response.json();
                    // Reject empty maps (e.g. /api/audio_map.json returns {})
                    if (candidate && Object.keys(candidate).length > 0) {
                        audioMap = candidate;
                        break;
                    }
                }
            } catch (err) {}
        }
        
        if (!audioMap) {
            console.warn('Could not load audio_map.json from any known location.');
            return;
        }

        function findMapping(map, s) {
            if (!s || !map) return null;
            if (map[s]) return map[s];
            var lower = s.toLowerCase();
            if (map[lower]) return map[lower];
            var norm = lower.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
            if (map[norm]) return map[norm];

            var m = s.match(/(?:stg|ben[ií_]?tez)[_-]?(\d+)/i);
            if (m) {
                var num = m[1];
                for (var k in map) {
                    var kLow = k.toLowerCase();
                    if (kLow.endsWith('_' + num) || kLow.endsWith('-' + num) || kLow.includes('_' + num + '_') || kLow.endsWith(' ' + num)) {
                        return map[k];
                    }
                }
            }
            return null;
        }
        
        var mapping = findMapping(audioMap, mapKey) || findMapping(audioMap, stem);
        
        if (!mapping) {
            console.warn('No audio mapping found for stem:', stem);
            return;
        }

        function resolveAudioCandidates(rawUrl) {
            if (!rawUrl) return [];
            var u = String(rawUrl).replace(/\\/g, '/');
            var candidates = [];
            var idx10 = u.toLowerCase().indexOf('10-audio/');
            if (idx10 !== -1) {
                var rel = u.slice(idx10);
                candidates.push('../../../' + rel);
                candidates.push('/case_files/' + rel);
                candidates.push('/_shared/cases/la8159/' + rel);
            }
            var la8159Idx = u.toLowerCase().indexOf('la8159/');
            if (la8159Idx !== -1) {
                var rel2 = u.slice(la8159Idx + 'la8159/'.length);
                candidates.push('../../../' + rel2);
                candidates.push('/case_files/' + rel2);
                candidates.push('/_shared/cases/la8159/' + rel2);
            }
            if (candidates.indexOf(u) === -1) candidates.push(u);
            return candidates;
        }

        // Single active playback context: audio element, button, segment element
        // and its word spans (used for karaoke highlighting).
        var playback = null;

        function clearHighlight(p) {
            if (!p) return;
            if (p.segEl) p.segEl.classList.remove('is-playing');
            if (p.words) {
                for (var i = 0; i < p.words.length; i++) {
                    p.words[i].el.classList.remove('active', 'past');
                }
            }
        }

        function stopPlayback() {
            if (!playback) return;
            if (playback.rafId) cancelAnimationFrame(playback.rafId);
            playback.rafId = null;
            if (playback.audio) {
                try { playback.audio.pause(); } catch (e) {}
                try { playback.audio.currentTime = 0; } catch (e) {}
            }
            if (playback.btn) playback.btn.textContent = '\u25b6 Play';
            clearHighlight(playback);
            playback = null;
        }

        function updateHighlight(p) {
            if (!p || !p.audio || !p.words) return;
            var t = p.audio.currentTime;
            var activeFound = false;
            for (var i = 0; i < p.words.length; i++) {
                var w = p.words[i];
                if (!activeFound && t >= w.start && t < w.end) {
                    w.el.classList.add('active');
                    w.el.classList.remove('past');
                    activeFound = true;
                } else {
                    w.el.classList.remove('active');
                    if (t >= w.end) {
                        w.el.classList.add('past');
                    } else {
                        w.el.classList.remove('past');
                    }
                }
            }
        }

        function startHighlightLoop(p) {
            function tick() {
                if (playback !== p) return;
                updateHighlight(p);
                p.rafId = requestAnimationFrame(tick);
            }
            p.rafId = requestAnimationFrame(tick);
        }

        function assignWordTimes(words, duration) {
            if (!duration || duration <= 0) return;
            var totalWeight = 0;
            for (var i = 0; i < words.length; i++) totalWeight += words[i].weight;
            if (!totalWeight) return;
            var cum = 0;
            for (var j = 0; j < words.length; j++) {
                var w = words[j];
                w.start = duration * (cum / totalWeight);
                cum += w.weight;
                w.end = duration * (cum / totalWeight);
            }
        }

        function tokenizeWords(segTextEl) {
            var raw = segTextEl.textContent;
            var tokens = raw.split(/(\s+)/);
            var html = '';
            var words = [];
            for (var i = 0; i < tokens.length; i++) {
                var tok = tokens[i];
                if (/^\s*$/.test(tok)) {
                    html += tok;
                } else {
                    html += '<span class="wl-word">' + escapeHtml(tok) + '</span>';
                    words.push({ el: null, weight: tok.length, start: 0, end: 0 });
                }
            }
            segTextEl.innerHTML = html;
            var spans = segTextEl.querySelectorAll('.wl-word');
            for (var k = 0; k < spans.length; k++) words[k].el = spans[k];
            return words;
        }

        function attachSegmentPlayer(seg) {
            var idMatch = seg.id.match(/seg-(\d+)/);
            if (!idMatch) return;
            var index = idMatch[1];
            
            var rawAudioUrl = mapping[index];
            if (!rawAudioUrl) return;

            var audioCandidates = resolveAudioCandidates(rawAudioUrl);
            var candidateIdx = 0;

            var actionsDiv = seg.querySelector('.seg-actions');
            if (!actionsDiv) return;

            var segTextEl = seg.querySelector('.seg-text');
            var words = segTextEl ? tokenizeWords(segTextEl) : [];

            var playBtn = seg.querySelector('.seg-play-btn');
            if (!playBtn) {
                playBtn = document.createElement('button');
                playBtn.className = 'seg-play-btn';
                playBtn.textContent = '\u25b6 Play';
                actionsDiv.insertBefore(playBtn, actionsDiv.firstChild);
            }
            
            // Lazy-load audio: only create Audio object on first click
            var audio = null;
            var loading = false;

            function tryLoadCandidate() {
                if (candidateIdx >= audioCandidates.length) {
                    loading = false;
                    playBtn.textContent = '✕ Error';
                    console.error('Failed to load audio for segment', index, 'tried candidates:', audioCandidates);
                    return;
                }
                var curUrl = audioCandidates[candidateIdx];
                audio = new Audio(curUrl);
                audio.addEventListener('loadeddata', function() {
                    loading = false;
                    playBtn.textContent = '⏸ Pause';
                    assignWordTimes(words, audio.duration);
                    if (words.length) seg.classList.add('is-playing');
                    playback = { audio: audio, btn: playBtn, segEl: seg, words: words, rafId: null };
                    startHighlightLoop(playback);
                    audio.play().catch(function(e) {
                        console.error('Audio playback failed:', e);
                        playBtn.textContent = '\u25b6 Play';
                    });
                });
                audio.addEventListener('error', function() {
                    candidateIdx++;
                    if (candidateIdx < audioCandidates.length) {
                        tryLoadCandidate();
                    } else {
                        loading = false;
                        playBtn.textContent = '\u26a0 Error';
                        console.error('Failed to load audio for segment', index, 'tried candidates:', audioCandidates);
                    }
                });
                audio.addEventListener('ended', function() {
                    stopPlayback();
                });
            }
            
            playBtn.addEventListener('click', function() {
                // Stop any currently playing audio (and clear its highlight)
                if (playback && playback.audio !== audio) {
                    stopPlayback();
                }
                
                // Lazy create audio element
                if (!audio && !loading) {
                    loading = true;
                    playBtn.textContent = '⟳ Loading...';
                    tryLoadCandidate();
                    return;
                }
                
                if (!audio) return;
                
                if (audio.paused) {
                    audio.play().then(function() {
                        playBtn.textContent = '⏸ Pause';
                        assignWordTimes(words, audio.duration);
                        if (words.length) seg.classList.add('is-playing');
                        playback = { audio: audio, btn: playBtn, segEl: seg, words: words, rafId: null };
                        startHighlightLoop(playback);
                    }).catch(function(e) {
                        console.error('Audio playback failed:', e);
                    });
                } else {
                    audio.pause();
                    if (playback && playback.rafId) cancelAnimationFrame(playback.rafId);
                    playback = null;
                    playBtn.textContent = '\u25b6 Play';
                    clearHighlight({ segEl: seg, words: words });
                }
            });

        }

        document.querySelectorAll('.transcript-segment').forEach(function(seg) {
            attachSegmentPlayer(seg);
        });
    } catch (e) {
        console.error('Error loading audio player:', e);
    }
});
