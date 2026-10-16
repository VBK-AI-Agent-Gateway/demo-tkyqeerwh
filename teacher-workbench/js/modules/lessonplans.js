/* ===== 课程备课 ===== */
let LP_FILTER = { q:'', status:'', showArchived:false };

function lessonPlanForm(lp){
  return `
  <div class="form-row"><label>课程标题 <span class="req">*</span></label>
    <input type="text" name="title" value="${UI.esc(lp.title||'')}" placeholder="例如：二次函数图像与性质"></div>
  <div class="form-grid">
    <div class="form-row"><label>学科</label>
      <select name="subject">${UI.options(['数学','语文','英语','物理','化学','生物','历史','地理','政治','其他'], lp.subject||'数学')}</select></div>
    <div class="form-row"><label>上课日期</label><input type="date" name="date" value="${UI.esc(lp.date||UI.today())}"></div>
    <div class="form-row"><label>时间段</label><input type="text" name="time" value="${UI.esc(lp.time||'')}" placeholder="08:00-08:45"></div>
    <div class="form-row"><label>班级/教室</label><input type="text" name="room" value="${UI.esc(lp.room||'')}" placeholder="三年2班"></div>
    <div class="form-row"><label>状态</label>
      <select name="status">${UI.options(['待上','进行中','已完成'], lp.status||'待上')}</select></div>
  </div>
  <div class="form-row"><label>教学目标 <span class="req">*</span></label>
    <textarea name="goal" placeholder="本节课学生应达成的目标…">${UI.esc(lp.goal||'')}</textarea></div>
  <div class="form-row"><label>课堂安排</label>
    <textarea name="arrangement" placeholder="导入 → 新知探究 → 例题 → 小结">${UI.esc(lp.arrangement||'')}</textarea></div>`;
}

function openLessonPlanDrawer(id){
  const lp = id ? DB.get('lessonplans', id) : null;
  UI.openDrawer({
    title: lp ? '编辑课程备课' : '新增课程备课',
    formKey: 'lessonplan',
    body: lessonPlanForm(lp || {}),
    onSave(v){
      if(!v.title.trim()){ UI.toast('请填写课程标题'); return false; }
      if(!v.goal.trim()){ UI.toast('请填写教学目标'); return false; }
      if(lp) DB.update('lessonplans', lp.id, v);
      else DB.insert('lessonplans', Object.assign({ archived:false }, v));
      rerender();
    }
  });
}
window.openLessonPlanDrawer = openLessonPlanDrawer;

function renderLessonPlans(view){
  const f = LP_FILTER;
  let list = DB.list('lessonplans');
  if(!f.showArchived) list = list.filter(l => !l.archived);
  if(f.status) list = list.filter(l => l.status === f.status);
  if(f.q){
    const q = f.q.toLowerCase();
    list = list.filter(l => JSON.stringify(l).toLowerCase().includes(q));
  }
  list.sort((a,b)=>(a.date||'').localeCompare(b.date||''));

  view.innerHTML = `
  <div class="page-head">
    <div><div class="page-title">课程备课</div><div class="page-sub">记录课程计划、教学目标与课堂安排，支持复制与归档</div></div>
    <button class="btn btn-primary" id="lpNew">＋ 新增备课</button>
  </div>
  <div class="toolbar">
    <input class="field" style="width:240px" id="lpQ" placeholder="搜索标题/目标/安排…" value="${UI.esc(f.q)}">
    <select class="field" style="width:130px" id="lpStatus">${UI.options(['','待上','进行中','已完成'], f.status)}</select>
    <label style="display:flex;align-items:center;gap:5px;font-size:13px;color:var(--text-2)">
      <input type="checkbox" id="lpArch" ${f.showArchived?'checked':''}> 显示已归档
    </label>
    <div class="spacer"></div>
    <span class="hint">右键行可快捷操作</span>
  </div>
  <div class="card" style="padding:0">
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>课程标题</th><th>学科</th><th>日期</th><th>时间</th><th>班级</th><th>状态</th><th>操作</th></tr></thead>
        <tbody id="lpBody">
        ${list.length ? list.map(l=>`
          <tr data-id="${l.id}" class="${l.archived?'dim':''}">
            <td><strong>${UI.esc(l.title)}</strong>${l.archived?' <span class="badge gray">已归档</span>':''}
              <div class="hint">${UI.esc((l.goal||'').slice(0,44))}</div></td>
            <td>${UI.esc(l.subject||'')}</td>
            <td>${UI.esc(l.date||'')}</td>
            <td>${UI.esc(l.time||'')}</td>
            <td>${UI.esc(l.room||'')}</td>
            <td><span class="badge ${l.status==='已完成'?'green':(l.status==='进行中'?'':'gray')}">${UI.esc(l.status||'')}</span></td>
            <td class="ops">
              <button class="btn btn-xs" data-act="edit">编辑</button>
              <button class="btn btn-xs" data-act="copy">复制</button>
              <button class="btn btn-xs" data-act="archive">${l.archived?'恢复':'归档'}</button>
            </td>
          </tr>`).join('') : '<tr><td colspan="7"><div class="empty">暂无备课记录，点击右上角新增</div></td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;

  document.getElementById('lpNew').onclick = ()=>openLessonPlanDrawer();
  document.getElementById('lpQ').oninput = UI.debounce(e=>{ LP_FILTER.q = e.target.value; rerender(); }, 250);
  document.getElementById('lpStatus').onchange = e=>{ LP_FILTER.status = e.target.value; rerender(); };
  document.getElementById('lpArch').onchange = e=>{ LP_FILTER.showArchived = e.target.checked; rerender(); };

  view.querySelectorAll('#lpBody tr[data-id]').forEach(tr=>{
    const id = tr.dataset.id;
    const act = a=>{
      const lp = DB.get('lessonplans', id);
      if(a==='edit') openLessonPlanDrawer(id);
      if(a==='copy'){ DB.duplicate('lessonplans', id); rerender(); UI.toast('已复制课程'); }
      if(a==='archive'){ DB.update('lessonplans', id, { archived: !lp.archived }); rerender(); UI.toast(lp.archived?'已恢复':'已归档'); }
      if(a==='del'){ DB.remove('lessonplans', id); rerender(); UI.toast('已删除'); }
      if(a==='review'){
        DB.insert('reviews', { courseId:id, date:UI.today(), highlights:'', problems:'', improvements:'' });
        location.hash = '#/review'; UI.toast('已创建复盘草稿，请到教学复盘完善');
      }
    };
    tr.querySelectorAll('button[data-act]').forEach(b=> b.onclick = e=>{ e.stopPropagation(); act(b.dataset.act); });
    tr.ondblclick = ()=>openLessonPlanDrawer(id);
    tr.addEventListener('contextmenu', e=>UI.ctxMenu(e,[
      { act:'edit', label:'编辑', run:()=>act('edit') },
      { act:'copy', label:'复制课程', run:()=>act('copy') },
      { act:'archive', label:'归档/恢复', run:()=>act('archive') },
      { act:'review', label:'写教学复盘', run:()=>act('review') },
      '-',
      { act:'del', label:'删除', danger:true, run:()=>act('del') }
    ]));
  });
}