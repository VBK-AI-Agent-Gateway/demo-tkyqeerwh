/* ===== 教学计划: 周/月计划 + 日历视图, 任务自动同步首页待办 ===== */
function renderPlanning(view){
  const plans = DB.list('plans');
  const now = new Date();
  const ym = now.getFullYear(), mo = now.getMonth();

  const weekPlans = plans.filter(p=>p.kind==='周计划');
  const monthPlans = plans.filter(p=>p.kind==='月计划');
  const events = plans.filter(p=>p.date);

  view.innerHTML = `
  <div class="page-head">
    <div class="page-title-row"><h2>教学计划</h2></div>
    <div class="btn-row">
      <button class="btn btn-primary" id="pNew">＋ 新增计划任务</button>
    </div>
  </div>
  <div class="grid-2" style="align-items:start">
    <div class="card">
      <div class="card-head"><h3>周计划</h3></div>
      <div class="card-body" id="weekList">${renderPlanList(weekPlans)}</div>
    </div>
    <div class="card">
      <div class="card-head"><h3>月计划</h3></div>
      <div class="card-body" id="monthList">${renderPlanList(monthPlans)}</div>
    </div>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="card-head"><h3>${ym} 年 ${mo+1} 月 · 日历视图（勾选=完成，同步首页待办）</h3></div>
    <div class="card-body">
      <div class="cal-grid cal-head">${['一','二','三','四','五','六','日'].map(d=>'<div class="cal-h">'+d+'</div>').join('')}</div>
      <div class="cal-grid" id="calBody">${renderCalendar(ym, mo, events)}</div>
    </div>
  </div>`;

  document.getElementById('pNew').onclick = ()=>openPlanDrawer();
  bindPlanList(document.getElementById('weekList'));
  bindPlanList(document.getElementById('monthList'));
  bindCalendar();
}

function renderPlanList(list){
  if(!list.length) return '<div class="empty-sm">暂无计划，点击右上角新增</div>';
  return list.map(p=>`
    <div class="plan-row" data-id="${p.id}">
      <input type="checkbox" class="p-done" ${p.done?'checked':''}>
      <div class="plan-info">
        <div class="plan-title ${p.done?'done':''}">${UI.esc(p.title)}</div>
        <div class="plan-meta">${UI.esc(p.start||'')} ${p.end?'~ '+UI.esc(p.end):''} ${p.date?'· 日程 '+UI.esc(p.date):''}</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-xs btn-ghost p-edit">编辑</button>
        <button class="btn btn-xs btn-ghost p-del">删除</button>
      </div>
    </div>`).join('');
}

function bindPlanList(root){
  if(!root) return;
  root.querySelectorAll('.plan-row').forEach(row=>{
    const id = row.dataset.id;
    row.querySelector('.p-done').onchange = e=>{
      DB.update('plans', id, {done:e.target.checked});
      UI.toast(e.target.checked ? '已完成，已同步首页待办' : '已取消完成');
      rerender();
    };
    row.querySelector('.p-edit').onclick = ()=>openPlanDrawer(id);
    row.querySelector('.p-del').onclick = ()=>{
      if(confirm('删除该计划任务？')){ DB.remove('plans', id); UI.toast('已删除'); rerender(); }
    };
    row.oncontextmenu = e=>UI.ctxMenu(e, [
      {act:'edit', label:'编辑', run:()=>openPlanDrawer(id)},
      {act:'done', label:'切换完成', run:()=>{ const p=DB.get('plans',id); DB.update('plans',id,{done:!p.done}); rerender(); }},
      '-',
      {act:'del', label:'删除', danger:true, run:()=>{ if(confirm('删除该计划？')){DB.remove('plans',id); rerender();} }}
    ]);
  });
}

function renderCalendar(ym, mo, events){
  const first = new Date(ym, mo, 1);
  const startDow = (first.getDay()+6)%7; // 周一为0
  const days = new Date(ym, mo+1, 0).getDate();
  const today = UI.today();
  let cells = '';
  for(let i=0;i<startDow;i++) cells += '<div class="cal-cell other"></div>';
  for(let d=1; d<=days; d++){
    const ds = ym+'-'+String(mo+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const evs = events.filter(e=>e.date===ds);
    const isToday = ds===today;
    cells += `<div class="cal-cell${isToday?' today':''}" data-date="${ds}">
      <div class="cal-d">${d}</div>
      ${evs.map(e=>`<div class="cal-ev ${e.done?'done':''}" data-id="${e.id}" title="${UI.esc(e.title)}">${UI.esc(e.title)}</div>`).join('')}
    </div>`;
  }
  return cells;
}

function bindCalendar(){
  const body = document.getElementById('calBody');
  if(!body) return;
  body.querySelectorAll('.cal-cell:not(.other)').forEach(cell=>{
    cell.ondblclick = ()=>openPlanDrawer(null, cell.dataset.date);
    cell.oncontextmenu = e=>{ if(!e.target.closest('.cal-ev')) UI.ctxMenu(e, [
      {act:'add', label:'新增任务到 '+cell.dataset.date, run:()=>openPlanDrawer(null, cell.dataset.date)}
    ]); };
  });
  body.querySelectorAll('.cal-ev').forEach(ev=>{
    ev.onclick = ()=>openPlanDrawer(ev.dataset.id);
    ev.oncontextmenu = e=>UI.ctxMenu(e, [
      {act:'edit', label:'编辑', run:()=>openPlanDrawer(ev.dataset.id)},
      {act:'done', label:'切换完成', run:()=>{ const p=DB.get('plans',ev.dataset.id); DB.update('plans',ev.dataset.id,{done:!p.done}); rerender(); }},
      '-',
      {act:'del', label:'删除', danger:true, run:()=>{ if(confirm('删除？')){DB.remove('plans',ev.dataset.id); rerender();} }}
    ]);
  });
}

/* 侧滑抽屉: 新增/编辑计划(勾选完成的任务会同步首页待办) */
function openPlanDrawer(id, presetDate){
  const p = id ? DB.get('plans', id) : null;
  UI.openDrawer({
    title: p ? '编辑计划任务' : '新增计划任务',
    formKey: 'plan',
    body: `
      <div class="form-row"><label>标题 *</label><input name="title" value="${UI.esc(p?p.title:'')}" placeholder="如：完成二次函数单元教学"></div>
      <div class="form-row"><label>类型</label><select name="kind">${UI.options(['周计划','月计划','日历'], p?p.kind:'周计划')}</select></div>
      <div class="form-row"><label>开始日期</label><input type="date" name="start" value="${p&&p.start?p.start:(presetDate||UI.today())}"></div>
      <div class="form-row"><label>结束日期</label><input type="date" name="end" value="${p&&p.end?p.end:''}"></div>
      <div class="form-row"><label>日历日期</label><input type="date" name="date" value="${p&&p.date?p.date:(presetDate||UI.today())}"></div>
      <div class="form-row"><label>备注</label><textarea name="note" rows="3" placeholder="补充说明">${UI.esc(p&&p.note?p.note:'')}</textarea></div>
      <div class="form-row"><label><input type="checkbox" name="done" ${p&&p.done?'checked':''}> 已完成</label></div>`,
    onSave(v){
      if(!v.title){ UI.toast('请填写标题'); return false; }
      const data = { title:v.title, kind:v.kind, start:v.start, end:v.end, date:v.date, note:v.note, done:!!v.done };
      if(p) DB.update('plans', p.id, data); else DB.insert('plans', data);
      rerender();
    }
  });
}
window.openPlanDrawer = openPlanDrawer;

/* ===== 数据与备份 ===== */
function renderSettings(view){
  const st = DB.stats();
  view.innerHTML = `
  <div class="page-head"><div class="page-title-row"><h2>数据与备份</h2></div></div>
  <div class="grid-2" style="align-items:start">
    <div class="card"><div class="card-head"><h3>数据概览</h3></div>
      <div class="card-body">
        <table class="table"><tbody>
        ${DB.KEYS.map(k=>`<tr><td>${k}</td><td class="ta-r">${st[k]||0} 条</td></tr>`).join('')}
        <tr><td>本地占用</td><td class="ta-r">${(st._bytes/1024).toFixed(1)} KB</td></tr>
        <tr><td>最后更新</td><td class="ta-r">${st._updatedAt?UI.fmtDate(st._updatedAt):'—'}</td></tr>
        </tbody></table>
      </div></div>
    <div class="card"><div class="card-head"><h3>备份 / 恢复</h3></div>
      <div class="card-body">
        <p class="hint">所有数据保存在浏览器 localStorage，可随时导出 JSON 备份，在其它设备导入恢复。</p>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn btn-primary" id="sExport">⭳ 导出备份文件</button>
          <button class="btn btn-ghost" id="sImport">⭱ 导入备份</button>
          <input type="file" id="sFile" accept="application/json" hidden>
          <button class="btn btn-ghost" id="sReset">重置为示例数据</button>
        </div>
      </div></div>
  </div>`;
  document.getElementById('sExport').onclick = ()=>{ DB.downloadBackup(); UI.toast('备份已下载'); };
  const fi = document.getElementById('sFile');
  document.getElementById('sImport').onclick = ()=>fi.click();
  fi.onchange = ()=>{
    const f = fi.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{ try{ DB.importBackup(rd.result); UI.toast('导入成功'); rerender(); }catch(e){ UI.toast('导入失败: '+e.message); } };
    rd.readAsText(f);
  };
  document.getElementById('sReset').onclick = ()=>{
    if(confirm('将清空当前数据并恢复示例数据，确定？')){ DB.resetAll(); UI.toast('已重置'); rerender(); }
  };
}