/**

  - KENZEN IndexedDB Storage Engine
  - Handles custom user tags, saved prompt presets, and undo/redo history. */
    class KenzenStorage { constructor() { this.dbName = "KenzenPerchanceDB";
    this.version = 1; this.db = null; }

async open() { if (this.db) return this.db; return new Promise((resolve, reject)
=> { const req = indexedDB.open(this.dbName, this.version); req.onupgradeneeded
= (e) => { const db = e.target.result; if
(!db.objectStoreNames.contains("custom_tags")) {
db.createObjectStore("custom_tags", { keyPath: "en" }); } if
(!db.objectStoreNames.contains("presets")) { db.createObjectStore("presets", {
keyPath: "id" }); } }; req.onsuccess = (e) => { this.db = e.target.result;
resolve(this.db); }; req.onerror = (e) => reject(e); }); }

async addCustomTag(categoryIndex, englishTag, japaneseLabel, slot = "Main") {
const db = await this.open(); return new Promise((resolve, reject) => { const tx
= db.transaction("custom_tags", "readwrite"); const store =
tx.objectStore("custom_tags"); const record = { categoryIndex: categoryIndex,
en: englishTag.trim(), jp: japaneseLabel.trim() || englishTag.trim(), slot:
slot, custom: true }; const req = store.put(record); req.onsuccess = () =>
resolve(record); req.onerror = () => reject(req.error); }); }

async getAllCustomTags() { const db = await this.open(); return new
Promise((resolve, reject) => { const tx = db.transaction("custom_tags",
"readonly"); const store = tx.objectStore("custom_tags"); const req =
store.getAll(); req.onsuccess = () => resolve(req.result || []); req.onerror =
() => reject(req.error); }); }

async deleteCustomTag(englishTag) { const db = await this.open(); return new
Promise((resolve, reject) => { const tx = db.transaction("custom_tags",
"readwrite"); const store = tx.objectStore("custom_tags"); const req =
store.delete(englishTag); req.onsuccess = () => resolve(true); req.onerror = ()
=> reject(req.error); }); }

async savePreset(name, tagsArray, mode = "flux") { const db = await this.open();
return new Promise((resolve, reject) => { const tx = db.transaction("presets",
"readwrite"); const store = tx.objectStore("presets"); const preset = { id:
"preset_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
name: name.trim() || ("Preset " + new Date().toLocaleDateString()), mode: mode,
tags: tagsArray, updatedAt: Date.now() }; const req = store.put(preset);
req.onsuccess = () => resolve(preset); req.onerror = () => reject(req.error);
}); }

async getPresets() { const db = await this.open(); return new Promise((resolve,
reject) => { const tx = db.transaction("presets", "readonly"); const store =
tx.objectStore("presets"); const req = store.getAll(); req.onsuccess = () => {
const sorted = (req.result || []).sort((a, b) => b.updatedAt - a.updatedAt);
resolve(sorted); }; req.onerror = () => reject(req.error); }); }

async deletePreset(id) { const db = await this.open(); return new
Promise((resolve, reject) => { const tx = db.transaction("presets",
"readwrite"); const store = tx.objectStore("presets"); const req =
store.delete(id); req.onsuccess = () => resolve(true); req.onerror = () =>
reject(req.error); }); } } window.kenzenStorage = new KenzenStorage(); [[[ END
FILE ]]]

[[[ START FILE: www/tag-inspector.js ]]] /**

  - Touch-First Tag Inspector: Bottom Sheet Modal for Mobile
  - Allows weight tweaking, space vs comma separator, alternation wrapper, and
    removal. */ class TagInspectorModal { constructor(onUpdate) { this.onUpdate
    = onUpdate; this.activeTag = null; this.weight = 1.0; this.mode = 'comma';
    // 'comma' | 'space' | 'curly' this.el = null; this.buildDOM(); }

buildDOM() { this.el = document.createElement('div'); this.el.className =
'inspector-overlay'; this.el.innerHTML = `    Tag Title 日本語  ✕ 

    <div class="inspector-body">
      <label class="ins-label">Connection Syntax:</label>
      <div class="ins-btn-group">
        <button type="button" class="ins-btn active" data-sep="comma">Comma ( , )</button>
        <button type="button" class="ins-btn" data-sep="space">Space Preposition ( )</button>
        <button type="button" class="ins-btn" data-sep="curly">Alternation { A | B }</button>
      </div>

      <label class="ins-label" style="margin-top: 14px;">
        Weight / Emphasis: <span id="weightVal" style="color:var(--accent);">1.00</span>
      </label>
      <div style="display:flex; align-items:center; gap:10px;">
        <input type="range" id="insWeightSlider" min="0.5" max="1.8" step="0.05" value="1.0" style="flex:1;">
        <button type="button" class="btn-ctrl" id="insResetWeight" style="flex:0 0 auto;">1.0</button>
      </div>

      <div class="ins-preview" id="insPreview">sitting on</div>
    </div>

    <div class="inspector-footer">
      <button type="button" class="ins-action-btn ins-del" id="insRemove">Remove</button>
      <button type="button" class="ins-action-btn ins-save" id="insApply">Apply</button>
    </div>
  </div>
`;

const style = document.createElement('style');
style.textContent = `
  .inspector-overlay {
    position: fixed; inset: 0; z-index: 500;
    background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
    display: none; align-items: flex-end; justify-content: center;
  }
  .inspector-overlay.open { display: flex; }
  .inspector-card {
    background: var(--surface); border: 1.5px solid var(--border-accent);
    border-radius: 16px 16px 0 0; width: 100%; max-width: 500px;
    padding: 16px; box-shadow: 0 -10px 30px rgba(0,0,0,0.7);
    font-family: inherit; color: var(--text);
  }
  .inspector-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .inspector-title { font-size: 16px; font-weight: 700; color: #fff; }
  .inspector-jp { font-size: 11px; color: var(--whiskey); }
  .inspector-close { background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer; }
  .ins-label { font-size: 12px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 6px; }
  .ins-btn-group { display: flex; gap: 6px; }
  .ins-btn {
    flex: 1; padding: 8px 4px; font-size: 11.5px; border-radius: 8px;
    background: var(--bg); border: 1px solid var(--border);
    color: var(--text); cursor: pointer; font-family: inherit;
  }
  .ins-btn.active { background: var(--accent-dim); border-color: var(--accent); color: var(--accent-bright); font-weight: 700; }
  .ins-preview {
    background: var(--bg); border: 1px dashed var(--border-accent);
    border-radius: 8px; padding: 10px; margin-top: 14px;
    font-family: monospace; font-size: 13px; color: var(--accent-bright);
    word-break: break-all;
  }
  .inspector-footer { display: flex; gap: 8px; margin-top: 16px; }
  .ins-action-btn { flex: 1; height: var(--touch-min, 44px); border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; border: none; }
  .ins-save { background: var(--accent); color: #000; }
  .ins-del { background: rgba(248,113,113,0.15); border: 1px solid var(--danger); color: var(--danger); }
`;
document.head.appendChild(style);
document.body.appendChild(this.el);
this.bindEvents();

}

bindEvents() { this.el.querySelector('#insClose').onclick = () => this.close();
this.el.addEventListener('click', (e) => { if (e.target === this.el)
this.close(); });

const btns = this.el.querySelectorAll('.ins-btn');
btns.forEach(b => {
  b.onclick = () => {
    btns.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    this.mode = b.dataset.sep;
    this.updatePreview();
  };
});

const slider = this.el.querySelector('#insWeightSlider');
const valText = this.el.querySelector('#weightVal');
slider.oninput = (e) => {
  this.weight = parseFloat(e.target.value);
  valText.textContent = this.weight.toFixed(2);
  this.updatePreview();
};

this.el.querySelector('#insResetWeight').onclick = () => {
  this.weight = 1.0;
  slider.value = "1.0";
  valText.textContent = "1.00";
  this.updatePreview();
};

this.el.querySelector('#insApply').onclick = () => {
  if (this.activeTag) {
    this.onUpdate(this.activeTag, this.mode, this.weight);
  }
  this.close();
};

this.el.querySelector('#insRemove').onclick = () => {
  if (this.activeTag) {
    this.onUpdate(this.activeTag, 'remove', 1.0);
  }
  this.close();
};

}

open(tagRecord) { this.activeTag = tagRecord; this.weight = tagRecord.weight
|| 1.0; this.mode = tagRecord.space ? 'space' : (tagRecord.curly ? 'curly' :
'comma');

this.el.querySelector('#insTitle').textContent = tagRecord.en;
this.el.querySelector('#insJp').textContent = tagRecord.jp;
this.el.querySelector('#insWeightSlider').value = this.weight;
this.el.querySelector('#weightVal').textContent = this.weight.toFixed(2);

this.el.querySelectorAll('.ins-btn').forEach(b => {
  b.classList.toggle('active', b.dataset.sep === this.mode);
});

this.updatePreview();
this.el.classList.add('open');

}

updatePreview() { if (!this.activeTag) return; let t = this.activeTag.en; if
(this.weight !== 1.0) { t = (${t}:${this.weight.toFixed(2)}); } if (this.mode
=== 'curly') { t = {${t}|variation}; }
this.el.querySelector('#insPreview').textContent = (this.mode === 'space' ? "
[space] " : " [comma] ") + t; }

close() { this.el.classList.remove('open'); } }
