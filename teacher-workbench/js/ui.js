/* ===== UI 交互层: 抽屉 / 右键菜单 / toast / 全局搜索 / 面包屑 / 富文本 ===== */
const UI = (() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = () => new Date().toISOString().slice(0,10);
  const fmtDate = d => d ? String(d).slice(0,10) : '';

  // ---- toast ----
  let toastTimer;
  function toast(msg){
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{ t.hidden = true; }, 2200);
  }

  // ---- 抽屉 ----
  let drawerState = null; // {title, formKey, onSave, values, draftTimer}
  function openDrawer({title, formKey, body, values, onSave, onRender}){
    drawerState = { title, formKey, onSave };
    $('#drawerTitle').textContent = title;
    $('#drawerBody').innerHTML = body;
    $('#drawerDraftTip').textContent = '';
    $('#drawerMask').hidden = false;
    $('#drawer').hidden = false;
    if(onRender) onRender($('#drawerBody'));
    // 回填草稿(仅新增时)
    const draft = DB.loadDraft(formKey);
    if(draft && !values){
      Object.keys(draft).forEach(k=>{
        const el = $('#drawerBody [name="'+k+'"]');
        if(el && el.type !== 'file'){
          if(el.type==='checkbox') el.checked = !!draft[k];
          else if(el.classList.contains('rt-editor')) el.innerHTML = draft[k] || '';
          else el.value = draft[k];
        }
      });
      $('#drawerDraftTip').textContent = '已恢复自动草稿';
    }
    // 自动草稿: 输入时防抖保存
    $('#drawerBody').oninput = debounce(()=>{
      const v = collect();
      if(Object.keys(v).length){
        if(DB.saveDraft(formKey, v)){
          $('#drawerDraftTip').textContent = '草稿已自动保存 ' + new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
        }
      }
    }, 700);
    const first = $('#drawerBody input,#drawerBody select,#drawerBody textarea,.rt-editor');
    if(first) first.focus();
  }
  function collect(){
    const v = {};
    $$('#drawerBody [name]').forEach(el=>{
      if(el.classList.contains('rt-editor')) v[el.getAttribute('name')] = el.innerHTML;
      else if(el.type === 'checkbox') v[el.name] = el.checked;
      else v[el.name] = el.value;
    });
    return v;
  }
  function closeDrawer(){
    $('#drawerMask').hidden = true;
    $('#drawer').hidden = true;
    drawerState = null;
    $('#drawerBody').oninput = null;
  }
  function saveDrawer(){
    if(!drawerState) return;
    const v = collect();
    try{
      const r = drawerState.onSave(v);
      if(r === false) return; // 校验失败由模块提示
      DB.clearDraft(drawerState.formKey);
      closeDrawer();
      toast('已保存');
    }catch(e){ console.error(e); toast('保存失败: ' + e.message); }
  }
  function bindDrawer(){
    $('#drawerClose').onclick = closeDrawer;
    $('#drawerCancel').onclick = closeDrawer;
    $('#drawerMask').onclick = closeDrawer;
    $('#drawerSave').onclick = saveDrawer;
  }

  // ---- 右键菜单 ----
  function ctxMenu(e, items){
    e.preventDefault(); e.stopPropagation();
    const m = $('#ctxMenu');
    m.innerHTML = items.map(it =>
      it === '-' ? '<hr>' :
      '<button data-act="'+esc(it.act)+'"'+(it.danger?' class="danger"':'')+'>'+esc(it.label)+'</button>'
    ).join('');
    m.hidden = false;
    const x = Math.min(e.clientX, window.innerWidth - 170);
    const y = Math.min(e.clientY, window.innerHeight - (items.length*36+14));
    m.style.left = x + 'px';
    m.style.top = y + 'px';
    m.onclick = ev => {
      const b = ev.target.closest('button');
      if(!b) return;
      m.hidden = true;
      const it = items.find(i => i !== '-' && i.act === b.dataset.act);
      if(it && it.run) it.run();
    };
  }
  function hideCtx(){ $('#ctxMenu').hidden = true; }
  document.addEventListener('click', hideCtx);

  // ---- 面包屑 ----
  function breadcrumb(parts){
    // parts: [{label, href}, ...]
    $('#breadcrumb').innerHTML = parts.map((p,i)=>{
      const last = i === parts.length-1;
      const sep = i ? '<span class="sep">/</span>' : '';
      return sep + (last ? '<span class="cur">'+esc(p.label)+'</span>'
        : '<a href="'+esc(p.href)+'">'+esc(p.label)+'</a>');
    }).join('');
  }

  // ---- 全局搜索 ----
  const SEARCH_SOURCES = [
    { col:'lessonplans', type:'课程备课', route:'#/lesson-plans', title:r=>r.title },
    { col:'notes', type:'教案', route:'#/teaching-notes', title:r=>r.title },
    { col:'courseware', type:'课件', route:'#/courseware', title:r=>r.name },
    { col:'questions', type:'题目', route:'#/question-bank', title:r=>r.text },
    { col:'students', type:'学生', route:'#/grades', title:r=>r.name },
    { col:'reviews', type:'复盘', route:'#/review', title:r=>r.highlights },
    { col:'plans', type:'计划', route:'#/planning', title:r=>r.title },
    { col:'tasks', type:'任务', route:'#/planning', title:r=>r.text }
  ];
  function globalSearch(q){
    q = (q||'').trim().toLowerCase();
    const box = $('#searchResults');
    if(!q){ box.hidden = true; box.innerHTML=''; return []; }
    const hits = [];
    SEARCH_SOURCES.forEach(src=>{
      DB.list(src.col).forEach(r=>{
        const hay = JSON.stringify(r).toLowerCase();
        if(hay.indexOf(q) >= 0)
          hits.push({ type:src.type, route:src.route, title:(src.title(r)||'').slice(0,60), id:r.id, col:src.col });
      });
    });
    box.hidden = false;
    box.innerHTML = hits.length
      ? hits.slice(0,30).map((h,i)=>'<div class="sr-item" data-i="'+i+'"><span>'+esc(h.title)+'</span><span class="sr-type">'+h.type+'</span></div>').join('')
      : '<div class="sr-empty">无匹配结果</div>';
    box.onclick = ev=>{
      const it = ev.target.closest('.sr-item');
      if(!it) return;
      const h = hits[+it.dataset.i];
      box.hidden = true;
      $('#globalSearch').value = '';
      location.hash = h.route;
    };
    return hits;
  }

  // ---- 富文本 ----
  function rtToolbar(cmd){
    const map = {
      bold:'<b>B</b>', italic:'<i>I</i>', underline:'<u>U</u>', strikeThrough:'<s>S</s>',
      formatBlock_p:'¶', formatBlock_h2:'H2', formatBlock_h3:'H3',
      insertUnorderedList:'• 列表', insertOrderedList:'1. 编号', insertHorizontalRule:'—',
      removeFormat:'清除格式'
    };
    const btns = Object.keys(map).map(k=>{
      const c = k.split('_');
      return '<button type="button" data-cmd="'+c[0]+'" data-val="'+(c[1]||'')+'" title="'+k+'">'+map[k]+'</button>';
    }).join('');
    return '<div class="rt-toolbar">'+btns+'</div>';
  }
  function bindRichText(root){
    const editor = root.querySelector('.rt-editor');
    if(!editor) return;
    root.querySelectorAll('.rt-toolbar button').forEach(b=>{
      b.addEventListener('mousedown', e=>e.preventDefault());
      b.addEventListener('click', ()=>{
        editor.focus();
        const cmd = b.dataset.cmd;
        let val = b.dataset.val || null;
        if(cmd === 'formatBlock') val = '<'+val+'>';
        try{ document.execCommand(cmd, false, val); }catch(e){}
      });
    });
  }

  function debounce(fn, ms){
    let t; return function(){ clearTimeout(t); t = setTimeout(()=>fn.apply(this, arguments), ms); };
  }

  // 选项生成
  function options(list, selected){
    return list.map(o=>{
      const v = typeof o === 'object' ? o.v : o;
      const l = typeof o === 'object' ? o.l : o;
      return '<option value="'+esc(v)+'"'+(String(v)===String(selected)?' selected':'')+'>'+esc(l)+'</option>';
    }).join('');
  }

  return { $, $$, esc, today, fmtDate, toast, openDrawer, closeDrawer, saveDrawer, bindDrawer,
           collect, ctxMenu, hideCtx, breadcrumb, globalSearch, rtToolbar, bindRichText,
           debounce, options };
})();