/* ===== 教学复盘: 绑定课程 / 亮点问题改进 / 时间线 ===== */
function openReviewDrawer(id){
  const rv = id ? DB.get('reviews', id) : null;
  const lessons = DB.list('lessonplans');
  UI.openDrawer({
    title: rv ? '编辑复盘' : '新增教学复盘',
    formKey: 'review',
    body:`
      <div class="form-row"><label>绑定课程 <span class="req">*</span></label>
        <select name="courseId">${UI.options(lessons.map(l=>({v:l.id,l:l.title+'（'+(l.date||'')+'）'})), rv?rv.courseId:'')}</select>
        ${lessons.length?'':'<div class="hint">暂无课程，请先到“课程备课”新增</div>'}</div>
      <div class="form-row"><label>复盘日期</label><input type="date" name="date" value="${UI.esc(rv?rv.date:UI.today())}"></div>
      <div class="form-row"><label>课堂亮点</label>
        <textarea name="highlights" placeholder="学生参与度高、哪个环节效果好…">${UI.esc(rv?rv.highlights:'')}</textarea></div>
      <div class="form-row"><label>存在问题</label>
        <textarea name="problems" placeholder="时间把控、难点突破不足…">${UI.esc(rv?rv.problems:'')}</textarea></div>
      <div class="form-row"><label>改进方向</label>
        <textarea name="improvements" placeholder="下次如何调整…">${UI.esc(rv?rv.improvements:'')}</textarea></div>`,
    onSave(v){
      if(!v.courseId){ UI.toast('请选择绑定课程'); return false; }
      const data = { courseId:v.courseId, date:v.date, highlights:v.highlights, problems:v.problems, improvements:v.improvements };
      if(rv) DB.update('reviews', rv.id, data);
      else DB.insert('reviews', data);
      rerender();
    }
  });
}
window.openReviewDrawer = openReviewDrawer;

function renderReview(view){
  let list = DB.list('reviews').slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const lessons = DB.list('lessonplans');

  view.innerHTML = `
  <div class="page-head">
    <div><div class="page-title">教学复盘</div><div class="page-sub">绑定课程，记录课堂亮点、问题与改进方向，按时间线沉淀</div></div>
    <button class="btn btn-primary" id="rvNew">＋ 新增复盘</button>
  </div>
  <div class="card">
    <div class="card-title">复盘时间线</div>
    <div class="timeline">
      ${list.length ? list.map(rv=>{
        const lp = lessons.find(l=>l.id===rv.courseId);
        return `<div class="tl-item" data-id="${rv.id}">
          <div class="tl-head">
            <div class="tl-title">${UI.esc(lp?lp.title:'（课程已删除）')}</div>
            <div class="tl-date">${UI.esc(rv.date||'')}</div>
          </div>
          <div class="tl-sec"><b>✨ 亮点：</b>${UI.esc(rv.highlights||'—')}</div>
          <div class="tl-sec"><b>⚠️ 问题：</b>${UI.esc(rv.problems||'—')}</div>
          <div class="tl-sec"><b>🔧 改进：</b>${UI.esc(rv.improvements||'—')}</div>
        </div>`;
      }).join('') : '<div class="empty">还没有复盘点点记录，点击右上角新增</div>'}
    </div>
  </div>`;

  document.getElementById('rvNew').onclick = ()=>openReviewDrawer();
  view.querySelectorAll('.tl-item').forEach(el=>{
    const id = el.dataset.id;
    el.ondblclick = ()=>openReviewDrawer(id);
    el.addEventListener('contextmenu', e=>UI.ctxMenu(e,[
      { act:'edit', label:'编辑复盘', run:()=>openReviewDrawer(id) },
      '-',
      { act:'del', label:'删除', danger:true, run:()=>{ DB.remove('reviews', id); rerender(); UI.toast('已删除'); } }
    ]));
  });
}