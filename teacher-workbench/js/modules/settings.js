/* ===== 数据与备份: 导出/导入/统计/重置 ===== */
function renderSettings(view){
  const s = DB.stats();
  view.innerHTML = `
  <div class="page-head">
    <div><div class="page-title">数据与备份</div><div class="page-sub">数据保存在本浏览器 localStorage · 支持导出备份与恢复</div></div>
  </div>
  <div class="grid grid-2">
    <div class="card">
      <div class="card-title">数据统计</div>
      <table class="tbl">
        <tbody>
          ${DB.KEYS.map(k=>`<tr><td>${UI.esc(k)}</td><td style="text-align:right"><strong>${s[k]||0}</strong> 条</td></tr>`).join('')}
          <tr><td>本地占用</td><td style="text-align:right"><strong>${((s._bytes||0)/1024).toFixed(1)}</strong> KB</td></tr>
          <tr><td>最近更新</td><td style="text-align:right">${UI.esc(s._updatedAt ? String(s._updatedAt).replace('T',' ').slice(0,19) : '—')}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="card">
      <div class="card-title">备份与恢复</div>
      <div class="form-row">
        <label>导出备份</label>
        <button class="btn btn-primary" id="setExport">⬇ 导出 JSON 备份</button>
        <div class="hint">将全部模块数据下载为 JSON 文件，可在任意设备导入恢复</div>
      </div>
      <div class="form-row">
        <label>导入备份</label>
        <input type="file" id="setImportFile" accept="application/json,.json">
        <div class="hint">选择此前导出的 JSON 文件，导入将覆盖现有数据</div>
      </div>
      <hr style="border:none;border-top:1px solid var(--line);margin:14px 0">
      <div class="form-row">
        <label>危险操作</label>
        <button class="btn btn-danger" id="setReset">重置为初始示例数据</button>
      </div>
    </div>
  </div>
  <div class="card" style="margin-top:14px">
    <div class="card-title">自动草稿</div>
    <div class="hint">所有抽屉表单在输入时会自动保存草稿（保留 7 天），下次打开新增表单时自动恢复；保存成功后草稿自动清除。</div>
  </div>`;

  document.getElementById('setExport').onclick = ()=>{
    try{ DB.downloadBackup(); UI.toast('备份已导出'); }
    catch(e){ UI.toast('导出失败: ' + e.message); }
  };
  document.getElementById('setImportFile').onchange = e=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        DB.importBackup(reader.result);
        UI.toast('导入成功，正在刷新…');
        setTimeout(()=>rerender(), 600);
      }catch(err){ UI.toast('导入失败: ' + err.message); }
    };
    reader.readAsText(file, 'utf-8');
  };
  document.getElementById('setReset').onclick = ()=>{
    if(confirm('确定重置全部数据为初始示例数据？此操作不可撤销，建议先导出备份。')){
      DB.resetAll();
      UI.toast('已重置');
      rerender();
    }
  };
}