/* ===== 教案管理: 富文本 + 文件夹 + 标签 + 全文搜索 + 关联课件/试题 ===== */
let NOTE_FILTER = { folder:'', tag:'', q:'' };

function noteForm(note, folders){
  const tags = (note.tags||[]).join(', ');
  const cw = DB.list('courseware');
  const qs = DB.list('questions');
  const linked = note.linked||[];
  return `
  <div class="form-row"><label>教案标题 <span class="req">*</span></label>
    <input type="text" name="title" value="${UI.esc(note.title||'')}" placeholder="例如：二次函数专题教案"></div>
  <div class="form-grid">
    <div class="form-row"><label>文件夹</label>
      <select name="folderId">${UI.options(folders.map(f=>({v:f.id,l:f.name})), note.folderId||'')}</select></div>
    <div class="form-row"><label>标签（逗号分隔）</label>
      <input type="text" name="tags" value="${UI.esc(tags)}" placeholder="函数, 重点"></div>
  </div>
  <div class="form-row"><label>关联课件</label>
    <select name="linkedCw" multiple size="3" style="height:auto">
      ${cw.map(c=>`<option value="${UI.esc(c.name)}" ${linked.includes(c.name)?'selected':''}>${UI.esc(c.name)}</option>`).join('') || '<option disabled>暂无课件</option>'}
    </select></div>
  <div class="form-row"><label>关联试题</label>
    <select name="linkedQ" multiple size="3" style="height:auto">
      ${qs.map(q=>`<option value="${UI.esc(q.id)}" ${linked.includes(q.id)?'selected':''}>${UI.esc(q.text.slice(0,40))}</option>`).join('') || '<option disabled>暂无试题</option>'}
    </select></div>
  <div class="form-row"><label>正文 <span class="req">*</span></label>
    ${UI.rtToolbar()}
    <div class="rt-editor" name="html" contenteditable="true">${note.html || '<p>教学目标：…</p><p>教学过程：</p>'}</div>
    <div class="hint">支持加粗/标题/列表等基础排版，内容自动保存草稿</div>
  </div>`;
}

function openNoteDrawer(id){
  const note = id ? DB.get('notes', id) : null;
  const folders = DB.list('folders').filter(f=>f.kind==='notes');
  UI.openDrawer({
    title: note ? '编辑教案' : '新增教案',
    formKey: 'note',
    body: noteForm(note || {}, folders),
    onRender(root){ UI.bindRichText(root); },
    onSave(v){
      if(!v.title.trim()){ UI.toast('请填写标题'); return false; }
      if(!v.html || !v.html.replace(/<[^>]*>|&nbsp;|\s/g,'')){ UI.toast('正文不能为空'); return false; }
      const tags = (v.tags||'').split(/[,，]/).map(s=>s.trim()).filter(Boolean);
      const linked = [].concat(
        v.linkedCw ? (Array.isArray(v.linkedCw)?v.linkedCw:[v.linkedCw]) : [],
        v.linkedQ ? (Array.isArray(v.linkedQ)?v.linkedQ:[]).map(qid=>{
          const q = DB.get('questions', qid); return q ? q.text.slice(0,30) : qid; }) : []
      );
      const data = { title:v.title.trim(), folderId:v.folderId, tags, html:v.html, linked, updatedAt:new Date().toISOString() };
      if(note) DB.update('notes', note.id, data);
      else DB.insert('notes', data);
      rerender();
    }
  });
}
window.openNoteDrawer = openNoteDrawer;

function renderNotes(view){
  const folders = DB.list('folders').filter(f=>f.kind==='notes');
  const allTags = Array.from(new Set(DB.list('notes').flatMap(n=>n.tags||[])));
  const f = NOTE_FILTER;
  let list = DB.list('notes');
  if(f.folder) list = list.filter(n=>n.folderId===f.folder);
  if(f.tag) list = list.filter(n=>(n.tags||[]).includes(f.tag));
  if(f.q){
    const q = f.q.toLowerCase();
    list = list.filter(n => (n.title||'').toLowerCase().includes(q)
      || (n.tags||[]).join(',').toLowerCase().includes(q)
      || (n.html||'').replace(/<[^>]*>/g,'').toLowerCase().includes(q));
  }
  list.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));

  view.innerHTML = `
  <div class="page-head">
    <div><div class="page-title">教案管理</div><div class="page-sub">富文本编辑 · 文件夹分类 · 标签与全文搜索 · 关联课件试题</div></div>
    <button class="btn btn-primary" id="nNew">＋ 新增教案</button>
  </div>
  <div class="toolbar">
    <input class="field" style="width:280px" id="nQ" placeholder="全文搜索标题/标签/正文…" value="${UI.esc(f.q)}">
    <div class="spacer"></div>
    <button class="btn btn-sm" id="nNewFolder">＋ 文件夹</button>
  </div>
  <div class="with-aside">
    <div class="card" style="padding:10px">
      <div class="hint" style="padding:4px 8px">文件夹</div>
      <div class="folder-item ${!f.folder?'active':''}" data-f=""><span>全部教案</span><span class="cnt">${DB.list('notes').length}</span></div>
      ${folders.map(fd=>`
        <div class="folder-item ${f.folder===fd.id?'active':''}" data-f="${fd.id}">
          <span>📁 ${UI.esc(fd.name)}</span>
          <span class="cnt">${DB.list('notes', n=>n.folderId===fd.id).length}</span>
        </div>`).join('')}
      <hr style="border:none;border-top:1px solid var(--line);margin:8px 0">
      <div class="hint" style="padding:4px 8px">标签</div>
      <div class="tag-filter ${!f.tag?'active':''}" data-t="">全部标签</div>
      ${allTags.map(t=>`<div class="tag-filter ${f.tag===t?'active':''}" data-t="${UI.esc(t)}"># ${UI.esc(t)}</div>`).join('')}
    </div>
    <div>
      ${list.length ? list.map(n=>{
        const folder = folders.find(x=>x.id===n.folderId);
        const text = (n.html||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').trim();
        return `<div class="card note-card" data-id="${n.id}" style="cursor:pointer;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;gap:10px">
            <div>
              <div style="font-weight:600;font-size:15px">${UI.esc(n.title)}</div>
              <div class="hint">${folder?'📁 '+UI.esc(folder.name):'未分类'} · 更新 ${UI.fmtDate(n.updatedAt)}</div>
            </div>
            <div class="chips">${(n.tags||[]).map(t=>`<span class="chip">#${UI.esc(t)}</span>`).join('')}</div>
          </div>
          <div class="hint" style="margin-top:8px;line-height:1.6">${UI.esc(text.slice(0,120))}${text.length>120?'…':''}</div>
          ${(n.linked&&n.linked.length)?`<div class="hint" style="margin-top:6px">🔗 关联：${n.linked.map(UI.esc).join('、')}</div>`:''}
        </div>`;
      }).join('') : '<div class="card"><div class="empty">没有匹配的教案</div></div>'}
    </div>
  </div>`;

  document.getElementById('nNew').onclick = ()=>openNoteDrawer();
  document.getElementById('nQ').oninput = UI.debounce(e=>{ NOTE_FILTER.q = e.target.value; rerender(); }, 250);
  document.getElementById('nNewFolder').onclick = ()=>{
    UI.openDrawer({
      title:'新建文件夹', formKey:'folder',
      body:`<div class="form-row"><label>文件夹名称 <span class="req">*</span></label><input type="text" name="name" placeholder="例如：期中复习"></div>`,
      onSave(v){
        if(!v.name.trim()){ UI.toast('请输入名称'); return false; }
        DB.insert('folders', { name:v.name.trim(), kind:'notes' });
        rerender();
      }
    });
  };
  view.querySelectorAll('.folder-item').forEach(el=> el.onclick = ()=>{ NOTE_FILTER.folder = el.dataset.f; rerender(); });
  view.querySelectorAll('.tag-filter').forEach(el=> el.onclick = ()=>{ NOTE_FILTER.tag = el.dataset.t; rerender(); });
  view.querySelectorAll('.note-card').forEach(el=>{
    const id = el.dataset.id;
    el.onclick = ()=>openNoteDrawer(id);
    el.addEventListener('contextmenu', e=>UI.ctxMenu(e,[
      { act:'edit', label:'编辑教案', run:()=>openNoteDrawer(id) },
      { act:'copy', label:'复制教案', run:()=>{ DB.duplicate('notes', id); rerender(); UI.toast('已复制'); } },
      { act:'raw', label:'导出为 HTML', run:()=>{
          const n = DB.get('notes', id);
          const blob = new Blob([`<!DOCTYPE html><meta charset="utf-8"><h1>${UI.esc(n.title)}</h1>${n.html}`], {type:'text/html'});
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = n.title + '.html'; a.click();
        } },
      '-',
      { act:'del', label:'删除', danger:true, run:()=>{ DB.remove('notes', id); rerender(); UI.toast('已删除'); } }
    ]));
  });
}