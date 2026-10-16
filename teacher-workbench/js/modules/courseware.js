/* ===== 课件中心: 上传记录 / 预览 / 下载 / 文件夹分类 ===== */
let CW_FILTER = { folder:'', q:'', type:'' };

function coursewareForm(item){
  const folders = DB.list('folders').filter(f=>f.kind==='courseware');
  return `
  <div class="form-row"><label>文件名 <span class="req">*</span></label>
    <input type="text" name="name" value="${UI.esc(item.name||'')}" placeholder="例如：抛物线图像探究.pptx"></div>
  <div class="form-grid">
    <div class="form-row"><label>类型</label>
      <select name="type">${UI.options(['PPT','PDF','Word','图片','视频','其他'], item.type||'PPT')}</select></div>
    <div class="form-row"><label>大小</label><input type="text" name="size" value="${UI.esc(item.size||'')}" placeholder="例如 4.2 MB"></div>
    <div class="form-row"><label>文件夹</label>
      <select name="folderId">${UI.options(folders.map(f=>({v:f.id,l:f.name})), item.folderId||'')}</select></div>
    <div class="form-row"><label>下载链接（可选）</label>
      <input type="text" name="url" value="${UI.esc(item.url||'')}" placeholder="https://… 留空则使用本地导出"></div>
  </div>
  <div class="form-row"><label>备注</label><textarea name="note" placeholder="适用章节、课堂用途…">${UI.esc(item.note||'')}</textarea></div>
  <div class="form-row"><label>选择本地文件（仅记录文件信息，不上传服务器）</label>
    <input type="file" name="file" id="cwFile" class="field" style="padding:6px">
    <div class="hint">静态部署无后端：此处记录文件名/大小供管理与下载链接跳转</div>
  </div>`;
}

function openCoursewareDrawer(id){
  const item = id ? DB.get('courseware', id) : null;
  UI.openDrawer({
    title: item ? '编辑课件' : '添加课件资料',
    formKey: 'courseware',
    body: coursewareForm(item || {}),
    onRender(root){
      const fi = root.querySelector('#cwFile');
      if(fi) fi.onchange = ()=>{
        const f = fi.files[0]; if(!f) return;
        root.querySelector('[name=name]').value = f.name;
        root.querySelector('[name=size]').value = (f.size/1024 > 1024 ? (f.size/1048576).toFixed(1)+' MB' : Math.max(1,Math.round(f.size/1024))+' KB');
        const ext = (f.name.split('.').pop()||'').toLowerCase();
        const map = { ppt:'PPT', pptx:'PPT', pdf:'PDF', doc:'Word', docx:'Word', jpg:'图片', png:'图片', mp4:'视频' };
        if(map[ext]) root.querySelector('[name=type]').value = map[ext];
      };
    },
    onSave(v){
      if(!v.name.trim()){ UI.toast('请填写文件名'); return false; }
      const data = { name:v.name.trim(), type:v.type, size:v.size, folderId:v.folderId, url:v.url, note:v.note, uploadedAt:new Date().toISOString() };
      if(item) DB.update('courseware', item.id, data);
      else DB.insert('courseware', data);
      rerender();
    }
  });
}
window.openCoursewareDrawer = openCoursewareDrawer;

function previewCourseware(item){
  const body = `
    <div style="text-align:center;padding:20px 0">
      <div style="font-size:44px">${item.type==='PDF'?'📄':item.type==='PPT'?'📊':item.type==='视频'?'🎬':item.type==='图片'?'🖼️':'📦'}</div>
      <div style="font-weight:600;font-size:15px;margin-top:8px">${UI.esc(item.name)}</div>
      <div class="hint">${UI.esc(item.type)} · ${UI.esc(item.size||'未知大小')} · 上传于 ${UI.fmtDate(item.uploadedAt)}</div>
      ${item.note?`<div class="hint" style="margin-top:8px">备注：${UI.esc(item.note)}</div>`:''}
      ${item.url?`<div style="margin-top:14px"><a class="btn btn-primary" href="${UI.esc(item.url)}" target="_blank" rel="noopener">打开链接</a></div>`
        :'<div class="hint" style="margin-top:14px">未配置下载链接</div>'}
    </div>`;
  UI.openDrawer({
    title:'课件预览', formKey:'cwpreview_'+item.id, body,
    onSave(){ UI.closeDrawer(); }
  });
  // 预览抽屉只保留关闭
  document.getElementById('drawerSave').textContent = '关闭';
  document.getElementById('drawerSave').onclick = ()=>{ UI.closeDrawer(); document.getElementById('drawerSave').textContent='保存'; document.getElementById('drawerSave').onclick = UI.saveDrawer; };
}

function renderCourseware(view){
  const folders = DB.list('folders').filter(f=>f.kind==='courseware');
  const f = CW_FILTER;
  let list = DB.list('courseware');
  if(f.folder) list = list.filter(c=>c.folderId===f.folder);
  if(f.type) list = list.filter(c=>c.type===f.type);
  if(f.q) list = list.filter(c => JSON.stringify(c).toLowerCase().includes(f.q.toLowerCase()));
  list.sort((a,b)=>(b.uploadedAt||'').localeCompare(a.uploadedAt||''));

  view.innerHTML = `
  <div class="page-head">
    <div><div class="page-title">课件中心</div><div class="page-sub">PPT / PDF / 教学资料的上传记录、预览、下载与文件夹分类</div></div>
    <button class="btn btn-primary" id="cwNew">＋ 添加课件</button>
  </div>
  <div class="toolbar">
    <input class="field" style="width:240px" id="cwQ" placeholder="搜索文件名/备注…" value="${UI.esc(f.q)}">
    <select class="field" style="width:120px" id="cwType">${UI.options(['','PPT','PDF','Word','图片','视频','其他'], f.type)}</select>
    <div class="spacer"></div>
    <button class="btn btn-sm" id="cwNewFolder">＋ 文件夹</button>
  </div>
  <div class="with-aside">
    <div class="card" style="padding:10px">
      <div class="folder-item ${!f.folder?'active':''}" data-f=""><span>全部课件</span><span class="cnt">${DB.list('courseware').length}</span></div>
      ${folders.map(fd=>`
        <div class="folder-item ${f.folder===fd.id?'active':''}" data-f="${fd.id}">
          <span>📁 ${UI.esc(fd.name)}</span>
          <span class="cnt">${DB.list('courseware', c=>c.folderId===fd.id).length}</span>
        </div>`).join('')}
    </div>
    <div class="card" style="padding:0">
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>文件名</th><th>类型</th><th>大小</th><th>文件夹</th><th>上传时间</th><th>操作</th></tr></thead>
          <tbody id="cwBody">
          ${list.length ? list.map(c=>{
            const fd = folders.find(x=>x.id===c.folderId);
            return `<tr data-id="${c.id}">
              <td><strong>${UI.esc(c.name)}</strong>${c.note?`<div class="hint">${UI.esc(c.note)}</div>`:''}</td>
              <td><span class="badge">${UI.esc(c.type)}</span></td>
              <td>${UI.esc(c.size||'-')}</td>
              <td>${fd?UI.esc(fd.name):'-'}</td>
              <td>${UI.fmtDate(c.uploadedAt)}</td>
              <td class="ops">
                <button class="btn btn-xs" data-act="preview">预览</button>
                <button class="btn btn-xs" data-act="download">下载</button>
                <button class="btn btn-xs" data-act="edit">编辑</button>
              </td></tr>`;
          }).join('') : '<tr><td colspan="6"><div class="empty">暂无课件</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;

  document.getElementById('cwNew').onclick = ()=>openCoursewareDrawer();
  document.getElementById('cwQ').oninput = UI.debounce(e=>{ CW_FILTER.q = e.target.value; rerender(); }, 250);
  document.getElementById('cwType').onchange = e=>{ CW_FILTER.type = e.target.value; rerender(); };
  document.getElementById('cwNewFolder').onclick = ()=>{
    UI.openDrawer({ title:'新建课件文件夹', formKey:'cwf',
      body:`<div class="form-row"><label>名称 <span class="req">*</span></label><input type="text" name="name" placeholder="例如：必修二"></div>`,
      onSave(v){ if(!v.name.trim()){ UI.toast('请输入名称'); return false; }
        DB.insert('folders', { name:v.name.trim(), kind:'courseware' }); rerender(); } });
  };
  view.querySelectorAll('.folder-item').forEach(el=> el.onclick = ()=>{ CW_FILTER.folder = el.dataset.f; rerender(); });

  view.querySelectorAll('#cwBody tr[data-id]').forEach(tr=>{
    const id = tr.dataset.id;
    const act = a=>{
      const item = DB.get('courseware', id);
      if(a==='preview') previewCourseware(item);
      if(a==='edit') openCoursewareDrawer(id);
      if(a==='download'){
        if(item.url){ const w = window.open(item.url, '_blank'); if(!w) UI.toast('浏览器拦截了弹窗'); }
        else UI.toast('该课件未配置下载链接');
      }
      if(a==='del'){ DB.remove('courseware', id); rerender(); UI.toast('已删除'); }
    };
    tr.querySelectorAll('button[data-act]').forEach(b=> b.onclick = e=>{ e.stopPropagation(); act(b.dataset.act); });
    tr.addEventListener('contextmenu', e=>UI.ctxMenu(e,[
      { act:'preview', label:'预览', run:()=>act('preview') },
      { act:'download', label:'下载', run:()=>act('download') },
      { act:'edit', label:'编辑', run:()=>act('edit') },
      '-',
      { act:'del', label:'删除', danger:true, run:()=>act('del') }
    ]));
  });
}