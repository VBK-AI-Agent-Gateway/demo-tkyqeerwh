/* ===== 题库管理: 多题型 / 知识点难度筛选 / 勾选生成练习 / 学生反馈 ===== */
let QB_FILTER = { type:'', kp:'', diff:'', q:'' };
let QB_SELECTED = new Set();

function questionForm(q){
  return `
  <div class="form-row"><label>题型 <span class="req">*</span></label>
    <select name="type" id="qType">${UI.options(['选择题','填空题','判断题','解答题','简答题'], q.type||'选择题')}</select></div>
  <div class="form-row"><label>题干 <span class="req">*</span></label>
    <textarea name="text" style="min-height:90px" placeholder="输入题目内容…">${UI.esc(q.text||'')}</textarea></div>
  <div class="form-row" id="qOptionsRow"><label>选项（每行一个，如 A. …）</label>
    <textarea name="options" placeholder="A. 选项一&#10;B. 选项二&#10;C. 选项三&#10;D. 选项四">${UI.esc(q.options||'')}</textarea></div>
  <div class="form-grid">
    <div class="form-row"><label>知识点 <span class="req">*</span></label>
      <input type="text" name="kp" value="${UI.esc(q.kp||'')}" placeholder="例如：二次函数"></div>
    <div class="form-row"><label>难度</label>
      <select name="diff">${UI.options(['简单','中等','较难'], q.diff||'中等')}</select></div>
  </div>
  <div class="form-row"><label>参考答案</label>
    <input type="text" name="answer" value="${UI.esc(q.answer||'')}" placeholder="答案或评分要点"></div>`;
}

function openQuestionDrawer(id){
  const q = id ? DB.get('questions', id) : null;
  UI.openDrawer({
    title: q ? '编辑试题' : '录入试题',
    formKey: 'question',
    body: questionForm(q || {}),
    onRender(root){
      const sync = ()=>{
        const t = root.querySelector('#qType').value;
        root.querySelector('#qOptionsRow').style.display = (t==='选择题'?'':'none');
      };
      root.querySelector('#qType').onchange = sync; sync();
    },
    onSave(v){
      if(!v.text.trim()){ UI.toast('请填写题干'); return false; }
      if(!v.kp.trim()){ UI.toast('请填写知识点'); return false; }
      const data = { text:v.text.trim(), type:v.type, kp:v.kp.trim(), diff:v.diff,
                     options: v.type==='选择题' ? v.options : '', answer:v.answer, feedback:q?q.feedback||[]:[] };
      if(q) DB.update('questions', q.id, data);
      else DB.insert('questions', data);
      rerender();
    }
  });
}
window.openQuestionDrawer = openQuestionDrawer;

function renderQuestions(view){
  const qs = DB.list('questions');
  const kps = Array.from(new Set(qs.map(q=>q.kp).filter(Boolean)));
  const f = QB_FILTER;
  let list = qs;
  if(f.type) list = list.filter(q=>q.type===f.type);
  if(f.kp) list = list.filter(q=>q.kp===f.kp);
  if(f.diff) list = list.filter(q=>q.diff===f.diff);
  if(f.q) list = list.filter(q => JSON.stringify(q).toLowerCase().includes(f.q.toLowerCase()));

  const selected = qs.filter(q=>QB_SELECTED.has(q.id));

  view.innerHTML = `
  <div class="page-head">
    <div><div class="page-title">题库管理</div><div class="page-sub">按知识点与难度筛选，勾选题目一键生成练习，记录学生反馈</div></div>
    <button class="btn btn-primary" id="qNew">＋ 录入试题</button>
  </div>
  <div class="toolbar">
    <input class="field" style="width:220px" id="qQ" placeholder="搜索题干/知识点…" value="${UI.esc(f.q)}">
    <select class="field" style="width:120px" id="qTypeF">${UI.options(['','选择题','填空题','判断题','解答题','简答题'], f.type)}</select>
    <select class="field" style="width:140px" id="qKpF">${UI.options([''].concat(kps), f.kp)}</select>
    <select class="field" style="width:110px" id="qDiffF">${UI.options(['','简单','中等','较难'], f.diff)}</select>
    <div class="spacer"></div>
    <span class="hint">已选 ${QB_SELECTED.size} 题</span>
    <button class="btn btn-sm" id="qClearSel">清空选择</button>
    <button class="btn btn-primary btn-sm" id="qGen" ${QB_SELECTED.size?'':'disabled style="opacity:.5"'}>生成练习</button>
  </div>

  ${selected.length ? `
  <div class="practice-box" style="margin-bottom:14px">
    <h4>已选试题（${selected.length}）</h4>
    ${selected.map((q,i)=>`<div class="practice-q">${i+1}. ${UI.esc(q.text)} <span class="badge gray" style="margin-left:6px">${UI.esc(q.type)}·${UI.esc(q.diff)}</span></div>`).join('')}
  </div>`:''}

  <div class="card" style="padding:0">
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th style="width:36px"></th><th>题干</th><th>题型</th><th>知识点</th><th>难度</th><th>反馈</th><th>操作</th></tr></thead>
        <tbody id="qBody">
        ${list.length ? list.map(q=>`
          <tr data-id="${q.id}">
            <td><input type="checkbox" class="qChk" ${QB_SELECTED.has(q.id)?'checked':''} style="accent-color:var(--primary)"></td>
            <td><strong>${UI.esc(q.text)}</strong>
              ${q.options?`<div class="hint" style="white-space:pre-line">${UI.esc(q.options)}</div>`:''}
              ${q.answer?`<div class="hint">答案：${UI.esc(q.answer)}</div>`:''}</td>
            <td><span class="badge">${UI.esc(q.type)}</span></td>
            <td>${UI.esc(q.kp)}</td>
            <td><span class="badge ${q.diff==='简单'?'green':q.diff==='较难'?'red':'amber'}">${UI.esc(q.diff)}</span></td>
            <td>${(q.feedback&&q.feedback.length)?`<span class="badge gray" title="${UI.esc(q.feedback.map(x=>x.note).join('；'))}">${q.feedback.length} 条</span>`:'-'}</td>
            <td class="ops">
              <button class="btn btn-xs" data-act="edit">编辑</button>
              <button class="btn btn-xs" data-act="fb">反馈</button>
            </td></tr>`).join('') : '<tr><td colspan="7"><div class="empty">没有匹配的试题</div></td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;

  document.getElementById('qNew').onclick = ()=>openQuestionDrawer();
  document.getElementById('qQ').oninput = UI.debounce(e=>{ QB_FILTER.q = e.target.value; rerender(); }, 250);
  document.getElementById('qTypeF').onchange = e=>{ QB_FILTER.type = e.target.value; rerender(); };
  document.getElementById('qKpF').onchange = e=>{ QB_FILTER.kp = e.target.value; rerender(); };
  document.getElementById('qDiffF').onchange = e=>{ QB_FILTER.diff = e.target.value; rerender(); };
  document.getElementById('qClearSel').onclick = ()=>{ QB_SELECTED.clear(); rerender(); };
  document.getElementById('qGen').onclick = ()=>{
    if(!QB_SELECTED.size) return;
    const sel = qs.filter(q=>QB_SELECTED.has(q.id));
    UI.openDrawer({
      title:'生成练习', formKey:'practice',
      body:`<div class="practice-box"><h4>练习卷（${sel.length} 题 · 建议用时 ${sel.length*3} 分钟）</h4>
        ${sel.map((q,i)=>`<div class="practice-q">
          <div>${i+1}. ${UI.esc(q.text)}<span class="badge gray" style="margin-left:6px">${UI.esc(q.type)}</span></div>
          ${q.options?`<div class="hint" style="white-space:pre-line;margin-top:4px">${UI.esc(q.options)}</div>`:''}
        </div>`).join('')}</div>
        <div class="hint" style="margin-top:10px">可直接打印或导出 HTML 留档</div>`,
      onSave(){
        const html = `<!DOCTYPE html><meta charset="utf-8"><title>练习卷</title>
          <h2>课堂练习（${sel.length}题）</h2><ol>${sel.map(q=>`<li style="margin-bottom:10px">${UI.esc(q.text)}
          ${q.options?`<pre>${UI.esc(q.options)}</pre>`:''}</li>`).join('')}</ol>`;
        const blob = new Blob([html], {type:'text/html'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = '练习卷-' + UI.today() + '.html'; a.click();
        UI.closeDrawer(); UI.toast('练习已导出');
      }
    });
  };

  view.querySelectorAll('#qBody tr[data-id]').forEach(tr=>{
    const id = tr.dataset.id;
    tr.querySelector('.qChk').onchange = e=>{
      if(e.target.checked) QB_SELECTED.add(id); else QB_SELECTED.delete(id);
      rerender();
    };
    tr.querySelectorAll('button[data-act]').forEach(b=>{
      b.onclick = e=>{
        e.stopPropagation();
        if(b.dataset.act==='edit') openQuestionDrawer(id);
        if(b.dataset.act==='fb'){
          const q = DB.get('questions', id);
          UI.openDrawer({ title:'学生反馈', formKey:'fb_'+id,
            body:`<div class="hint" style="margin-bottom:8px">${UI.esc(q.text)}</div>
              <div class="form-row"><label>反馈学生</label><input type="text" name="student" placeholder="姓名"></div>
              <div class="form-row"><label>反馈内容 <span class="req">*</span></label>
                <textarea name="note" placeholder="例如：3人对D选项混淆…"></textarea></div>
              <div class="hint">已有反馈：</div>
              ${(q.feedback||[]).map(x=>`<div class="practice-q">${UI.fmtDate(x.date)} · ${UI.esc(x.student||'匿名')}：${UI.esc(x.note)}</div>`).join('') || '<div class="hint">暂无</div>'}`,
            onSave(v){
              if(!v.note.trim()){ UI.toast('请填写反馈内容'); return false; }
              const fb = (q.feedback||[]).concat([{ date:UI.today(), student:v.student, note:v.note.trim() }]);
              DB.update('questions', id, { feedback:fb });
              rerender();
            } });
        }
      };
    });
    tr.addEventListener('contextmenu', e=>UI.ctxMenu(e,[
      { act:'edit', label:'编辑试题', run:()=>openQuestionDrawer(id) },
      { act:'sel', label:QB_SELECTED.has(id)?'取消勾选':'勾选生成练习', run:()=>{
          if(QB_SELECTED.has(id)) QB_SELECTED.delete(id); else QB_SELECTED.add(id); rerender(); } },
      { act:'fb', label:'记录学生反馈', run:()=>{ tr.querySelector('[data-act=fb]').click(); } },
      '-',
      { act:'del', label:'删除', danger:true, run:()=>{ DB.remove('questions', id); QB_SELECTED.delete(id); rerender(); UI.toast('已删除'); } }
    ]));
  });
}