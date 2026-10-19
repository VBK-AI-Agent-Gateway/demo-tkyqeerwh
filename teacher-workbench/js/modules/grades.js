/* ===== 学生成绩: 录入 / 趋势图 / 班级统计 / 学生标记 ===== */
let GRADE_FILTER = { klass:'', subject:'' };

function drawLineChart(canvas, labels, series){
  // series: [{name, color, data}]
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 600, H = canvas.clientHeight || 240;
  canvas.width = W*dpr; canvas.height = H*dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0,0,W,H);
  const pad = {l:38, r:14, t:16, b:34};
  const all = series.flatMap(s=>s.data);
  const max = Math.max(100, ...all), min = Math.min(0, ...all);
  const X = i => pad.l + (W-pad.l-pad.r) * (labels.length<=1?0.5:i/(labels.length-1));
  const Y = v => pad.t + (H-pad.t-pad.b) * (1-(v-min)/(max-min||1));

  // 网格 + 刻度
  ctx.strokeStyle = '#e5e9f0'; ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif'; ctx.lineWidth = 1;
  for(let g=0; g<=4; g++){
    const v = min + (max-min)*g/4, y = Y(v);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W-pad.r, y); ctx.stroke();
    ctx.fillText(Math.round(v), 6, y+4);
  }
  labels.forEach((l,i)=>{
    ctx.textAlign='center'; ctx.fillText(l, X(i), H-12); ctx.textAlign='left';
  });
  // 折线
  series.forEach(s=>{
    ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = 2;
    ctx.beginPath();
    s.data.forEach((v,i)=>{ i? ctx.lineTo(X(i),Y(v)) : ctx.moveTo(X(i),Y(v)); });
    ctx.stroke();
    s.data.forEach((v,i)=>{
      ctx.beginPath(); ctx.arc(X(i),Y(v),3.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(X(i),Y(v),1.6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=s.color;
    });
  });
  // 图例
  let lx = pad.l;
  series.forEach(s=>{
    ctx.fillStyle = s.color; ctx.fillRect(lx, 2, 14, 4);
    ctx.fillStyle = '#64748b'; ctx.fillText(s.name, lx+18, 8);
    lx += 18 + ctx.measureText(s.name).width + 14;
  });
}

function openScoreDrawer(){
  const students = DB.list('students');
  UI.openDrawer({
    title:'录入成绩', formKey:'score',
    body:`
      <div class="form-row"><label>学生 <span class="req">*</span></label>
        <select name="studentId">${UI.options(students.map(s=>({v:s.id,l:s.name+'（'+s.klass+'）'})), '')}</select></div>
      <div class="form-grid">
        <div class="form-row"><label>学科</label>
          <select name="subject">${UI.options(['数学','语文','英语','物理','化学','生物'], '数学')}</select></div>
        <div class="form-row"><label>考试名称 <span class="req">*</span></label>
          <input type="text" name="exam" value="" placeholder="期中 / 月考一"></div>
        <div class="form-row"><label>分数 <span class="req">*</span></label>
          <input type="number" name="score" min="0" max="150" placeholder="0-150"></div>
        <div class="form-row"><label>日期</label><input type="date" name="date" value="${UI.today()}"></div>
      </div>
      ${students.length?'':'<div class="hint">提示：暂无学生档案，请先在下方“学生档案”新增</div>'}`,
    onSave(v){
      if(!v.studentId){ UI.toast('请选择学生'); return false; }
      if(!v.exam.trim()){ UI.toast('请填写考试名称'); return false; }
      const sc = parseFloat(v.score);
      if(isNaN(sc)){ UI.toast('请填写分数'); return false; }
      DB.insert('scores', { studentId:v.studentId, subject:v.subject, exam:v.exam.trim(), score:sc, date:v.date });
      rerender();
    }
  });
}

function openStudentDrawer(id){
  const s = id ? DB.get('students', id) : null;
  UI.openDrawer({
    title: s?'编辑学生':'新增学生', formKey:'student',
    body:`
      <div class="form-row"><label>姓名 <span class="req">*</span></label><input type="text" name="name" value="${UI.esc(s?s.name:'')}"></div>
      <div class="form-grid">
        <div class="form-row"><label>班级</label><input type="text" name="klass" value="${UI.esc(s?s.klass:'')}" placeholder="三年2班"></div>
        <div class="form-row"><label>标记</label>
          <select name="tag">${UI.options(['','进步显著','需要关注','偏科','状态稳定'], s?s.tag:'')}</select></div>
      </div>
      <div class="form-row"><label>备注</label><textarea name="note" placeholder="需要跟进的情况…">${UI.esc(s?s.note:'')}</textarea></div>`,
    onSave(v){
      if(!v.name.trim()){ UI.toast('请填写姓名'); return false; }
      if(s) DB.update('students', s.id, v);
      else DB.insert('students', v);
      rerender();
    }
  });
}

function renderGrades(view){
  const f = GRADE_FILTER;
  const students = DB.list('students').filter(s=>!f.klass || s.klass===f.klass);
  let scores = DB.list('scores');
  if(f.subject) scores = scores.filter(s=>s.subject===f.subject);
  const klasses = Array.from(new Set(DB.list('students').map(s=>s.klass).filter(Boolean)));
  const subjects = Array.from(new Set(DB.list('scores').map(s=>s.subject).filter(Boolean)));

  // 趋势图数据: 按考试时间排序的考试名 + 班级平均
  const exams = Array.from(new Set(scores.map(s=>s.exam)));
  const byDate = {};
  scores.forEach(s=>{ byDate[s.exam] = s.date; });
  exams.sort((a,b)=>(byDate[a]||'').localeCompare(byDate[b]||''));
  const avgSeries = exams.map(e=>{
    const rows = scores.filter(s=>s.exam===e);
    return rows.length ? rows.reduce((x,y)=>x+(+y.score),0)/rows.length : 0;
  });
  // 前2名学生个体趋势
  const topIds = students.slice(0,2).map(s=>s.id);
  const palette = ['#2563eb','#f59e0b'];
  const series = [{ name:'班级平均', color:'#2563eb', data:avgSeries.map(v=>+v.toFixed(1)) }];
  topIds.forEach((sid,i)=>{
    const st = DB.get('students', sid);
    if(!st) return;
    series.push({ name:st.name, color:palette[i], data: exams.map(e=>{
      const r = scores.find(s=>s.studentId===sid && s.exam===e); return r? +r.score : null;
    }).map((v,idx,arr)=>{
      // 断点用前值填充
      if(v!=null) return v;
      const prev = arr.slice(0,idx).reverse().find(x=>x!=null);
      return prev!=null?prev:0;
    }) });
  });

  // 班级统计
  const stats = klasses.map(k=>{
    const ids = DB.list('students', s=>s.klass===k).map(s=>s.id);
    const rows = scores.filter(s=>ids.includes(s.studentId));
    const avg = rows.length ? (rows.reduce((x,y)=>x+(+y.score),0)/rows.length).toFixed(1) : '--';
    const max = rows.length ? Math.max(...rows.map(r=>+r.score)) : '--';
    const min = rows.length ? Math.min(...rows.map(r=>+r.score)) : '--';
    const pass = rows.length ? Math.round(rows.filter(r=>+r.score>=60).length/rows.length*100) : '--';
    return { k, n:ids.length, avg, max, min, pass };
  });

  view.innerHTML = `
  <div class="page-head">
    <div><div class="page-title">学生成绩</div><div class="page-sub">成绩录入 · 趋势图表 · 班级统计 · 学生情况标记</div></div>
    <div style="display:flex;gap:8px">
      <button class="btn" id="gNewStudent">＋ 新增学生</button>
      <button class="btn btn-primary" id="gNewScore">＋ 录入成绩</button>
    </div>
  </div>
  <div class="toolbar">
    <select class="field" style="width:140px" id="gKlass">${UI.options([''].concat(klasses), f.klass)}</select>
    <select class="field" style="width:120px" id="gSubject">${UI.options([''].concat(subjects), f.subject)}</select>
  </div>

  <div class="grid grid-2" style="margin-bottom:14px">
    <div class="card">
      <div class="card-title">成绩趋势（${UI.esc(f.subject||'全部学科')}）</div>
      <div class="chart-box"><canvas class="chart" id="gradeChart"></canvas></div>
      <div class="hint">折线为班级平均与前两位学生各次考试走势</div>
    </div>
    <div class="card">
      <div class="card-title">班级成绩统计</div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>班级</th><th>人数</th><th>平均分</th><th>最高</th><th>最低</th><th>及格率</th></tr></thead>
        <tbody>${stats.map(s=>`<tr><td>${UI.esc(s.k)}</td><td>${s.n}</td><td><strong>${s.avg}</strong></td>
          <td>${s.max}</td><td>${s.min}</td><td>${s.pass}%</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">暂无数据</div></td></tr>'}</tbody>
      </table></div>
    </div>
  </div>

  <div class="grid grid-2">
    <div class="card">
      <div class="card-title">学生档案与标记</div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>姓名</th><th>班级</th><th>标记</th><th>最近均分</th><th>操作</th></tr></thead>
        <tbody id="gStudentBody">
        ${students.map(s=>{
          const my = DB.list('scores', x=>x.studentId===s.id);
          const avg = my.length ? (my.reduce((a,b)=>a+(+b.score),0)/my.length).toFixed(0) : '--';
          return `<tr data-id="${s.id}">
            <td><strong>${UI.esc(s.name)}</strong>${s.note?`<div class="hint">${UI.esc(s.note)}</div>`:''}</td>
            <td>${UI.esc(s.klass)}</td>
            <td>${s.tag?`<span class="badge ${s.tag==='需要关注'?'red':s.tag==='进步显著'?'green':'amber'}">${UI.esc(s.tag)}</span>`:'-'}</td>
            <td>${avg}</td>
            <td class="ops"><button class="btn btn-xs" data-act="edit">编辑</button>
              <button class="btn btn-xs" data-act="tag">标记</button></td></tr>`;
        }).join('') || '<tr><td colspan="5"><div class="empty">暂无学生</div></td></tr>'}
        </tbody></table></div>
    </div>

    <div class="card">
      <div class="card-title">成绩明细</div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>学生</th><th>学科</th><th>考试</th><th>分数</th><th>日期</th><th></th></tr></thead>
        <tbody>
        ${scores.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(sc=>{
          const st = DB.get('students', sc.studentId);
          return `<tr data-sid="${sc.id}">
            <td>${UI.esc(st?st.name:'?')}</td><td>${UI.esc(sc.subject)}</td><td>${UI.esc(sc.exam)}</td>
            <td><strong style="color:${+sc.score>=60?'var(--primary)':'#dc2626'}">${UI.esc(sc.score)}</strong></td>
            <td>${UI.fmtDate(sc.date)}</td>
            <td class="ops"><button class="btn btn-xs" data-act="del">删除</button></td></tr>`;
        }).join('') || '<tr><td colspan="6"><div class="empty">暂无成绩记录</div></td></tr>'}
        </tbody></table></div>
    </div>
  </div>`;

  // 图表
  requestAnimationFrame(()=>{
    const cv = document.getElementById('gradeChart');
    if(cv && exams.length) drawLineChart(cv, exams, series);
    else if(cv){
      const ctx = cv.getContext('2d');
      cv.width = cv.clientWidth; cv.height = cv.clientHeight;
      ctx.fillStyle='#94a3b8'; ctx.font='13px sans-serif'; ctx.textAlign='center';
      ctx.fillText('暂无成绩数据，先录入成绩', cv.clientWidth/2, cv.clientHeight/2);
    }
  });

  document.getElementById('gNewScore').onclick = openScoreDrawer;
  document.getElementById('gNewStudent').onclick = ()=>openStudentDrawer();
  document.getElementById('gKlass').onchange = e=>{ GRADE_FILTER.klass = e.target.value; rerender(); };
  document.getElementById('gSubject').onchange = e=>{ GRADE_FILTER.subject = e.target.value; rerender(); };

  view.querySelectorAll('#gStudentBody tr[data-id]').forEach(tr=>{
    const id = tr.dataset.id;
    tr.querySelectorAll('button[data-act]').forEach(b=> b.onclick = ()=>{
      if(b.dataset.act==='edit') openStudentDrawer(id);
      if(b.dataset.act==='tag'){
        const s = DB.get('students', id);
        UI.openDrawer({ title:'标记学生情况', formKey:'tag_'+id,
          body:`<div class="form-row"><label>标记</label>
              <select name="tag">${UI.options(['','进步显著','需要关注','偏科','状态稳定'], s.tag||'')}</select></div>
            <div class="form-row"><label>备注</label><textarea name="note">${UI.esc(s.note||'')}</textarea></div>`,
          onSave(v){ DB.update('students', id, { tag:v.tag, note:v.note }); rerender(); } });
      }
    });
    tr.addEventListener('contextmenu', e=>UI.ctxMenu(e,[
      { act:'edit', label:'编辑学生', run:()=>openStudentDrawer(id) },
      { act:'tag', label:'标记情况', run:()=>{ tr.querySelector('[data-act=tag]').click(); } },
      '-',
      { act:'del', label:'删除学生', danger:true, run:()=>{ DB.remove('students', id); rerender(); UI.toast('已删除'); } }
    ]));
  });
  view.querySelectorAll('tr[data-sid] button[data-act=del]').forEach(b=>{
    b.onclick = ()=>{ DB.remove('scores', b.closest('tr').dataset.sid); rerender(); UI.toast('已删除'); };
  });
}