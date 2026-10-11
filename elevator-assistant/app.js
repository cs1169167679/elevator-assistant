// ============================================================
// 电梯维修助手 - 核心逻辑
// ============================================================

// ---------- 全局状态 ----------
let isAdmin = false;          // 管理员模式（解锁后可编辑）
let currentTab = 'brands';    // 当前底部导航标签
let currentBrand = null;      // 当前进入的品牌
let touchTimer = null;        // 长按计时器

const ADMIN_PASSWORD = '101111';  // 管理员密码
const DELETE_PASSWORD = '8888';   // 删除密码

// ---------- 数据模型 ----------
// data = {
//   brands: [
//     { id, name, codes: [{ id, code, definition }] }
//   ],
//   favorites: [{ id, title, content }],
//   experiences: [{ id, title, content }],
//   debug: [{ id, title, content }]
// }

// ---------- 初始化 ----------
async function init() {
  await loadData();
  renderBrands();
  bindEvents();
}

// ---------- 数据读写（使用 localForage）----------
async function loadData() {
  let raw = await localforage.getItem('elevatorData');
  if (!raw) {
    raw = { brands: [], favorites: [], experiences: [], debug: [] };
    await localforage.setItem('elevatorData', raw);
  }
  window.appData = raw;
}

async function saveData() {
  await localforage.setItem('elevatorData', window.appData);
}

// ---------- 长按解锁管理员 ----------
function bindHeaderLongPress() {
  const header = document.getElementById('appHeader');

  const start = (e) => {
    if (isAdmin) return;  // 已解锁则忽略
    touchTimer = setTimeout(() => {
      showAdminModal();
    }, 10000);  // 10 秒
  };

  const cancel = () => {
    if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
  };

  header.addEventListener('touchstart', start);
  header.addEventListener('touchend', cancel);
  header.addEventListener('touchcancel', cancel);
  // 桌面端兼容
  header.addEventListener('mousedown', start);
  header.addEventListener('mouseup', cancel);
  header.addEventListener('mouseleave', cancel);
}

// ---------- 管理员密码验证 ----------
function showAdminModal() {
  document.getElementById('adminModal').classList.add('show');
  document.getElementById('adminPassword').value = '';
}

function verifyAdminPassword() {
  const input = document.getElementById('adminPassword').value;
  if (input === ADMIN_PASSWORD) {
    isAdmin = true;
    document.getElementById('lockIcon').textContent = '🔓';
    document.getElementById('adminModal').classList.remove('show');
    document.getElementById('addBtn').style.display = 'block';
    renderBrands();
    alert('✅ 管理员模式已开启，可以编辑了');
  } else {
    alert('❌ 密码错误');
    document.getElementById('adminPassword').value = '';
  }
}

// ---------- 删除二次确认 ----------
function confirmDelete(callback) {
  const modal = document.getElementById('deleteModal');
  modal.classList.add('show');
  document.getElementById('deletePassword').value = '';

  const confirmBtn = document.getElementById('deleteConfirm');
  const cancelBtn = document.getElementById('deleteCancel');

  // 移除旧监听，避免重复绑定
  const newConfirm = confirmBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  confirmBtn.replaceWith(newConfirm);
  cancelBtn.replaceWith(newCancel);

  newConfirm.onclick = () => {
    if (document.getElementById('deletePassword').value === DELETE_PASSWORD) {
      modal.classList.remove('show');
      callback();
    } else {
      alert('❌ 删除密码错误');
    }
  };
  newCancel.onclick = () => modal.classList.remove('show');
}

// ---------- 渲染品牌列表（含搜索过滤）----------
function renderBrands(filter = '') {
  const container = document.getElementById('brandList');
  const brands = window.appData.brands
    .filter(b => !filter || b.name.includes(filter) || 
                 b.codes.some(c => c.code.includes(filter) || c.definition.includes(filter)))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));  // 自动按拼音排序

  if (brands.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#999;padding:30px;">暂无品牌，' +
      (isAdmin ? '点击右下角 + 添加' : '请长按顶部标题解锁编辑') + '</p>';
    return;
  }

  container.innerHTML = brands.map(b => `
    <div class="brand-item" data-id="${b.id}">
      <span>${b.name} <small style="color:#999;">(${b.codes.length}个故障码)</small></span>
      <div class="item-actions">
        ${isAdmin ? `<button class="btn-edit" onclick="editBrand('${b.id}')">✏️</button>
                     <button class="btn-delete" onclick="deleteBrand('${b.id}')">🗑️</button>` : ''}
        <span class="arrow">›</span>
      </div>
    </div>
  `).join('');

  // 点击进入品牌详情
  container.querySelectorAll('.brand-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.item-actions')) return;  // 忽略按钮点击
      openBrand(el.dataset.id);
    });
  });
}

// ---------- 搜索 ----------
function bindSearch() {
  document.getElementById('searchInput').addEventListener('input', (e) => {
    renderBrands(e.target.value.trim());
  });
}

// ---------- 底部导航切换 ----------
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.bottom-nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.getElementById('brandList').style.display = tab === 'brands' ? 'block' : 'none';
  renderContentArea();
}

// ---------- 渲染内容区（收藏/经验/调试资料）----------
function renderContentArea() {
  const area = document.getElementById('contentArea');
  if (currentTab === 'brands') { area.innerHTML = ''; return; }

  const keyMap = { favorites: 'favorites', experience: 'experiences', debug: 'debug' };
  const key = keyMap[currentTab];
  const items = (window.appData[key] || []).sort((a, b) => a.title.localeCompare(b.title, 'zh'));

  if (items.length === 0) {
    area.innerHTML = `<p style="text-align:center;color:#999;padding:30px;">暂无内容</p>`;
    return;
  }

  area.innerHTML = items.map(item => `
    <div class="brand-item">
      <span>${item.title}</span>
      ${isAdmin ? `<div class="item-actions">
        <button class="btn-delete" onclick="deleteContent('${key}','${item.id}')">🗑️</button>
      </div>` : ''}
    </div>
  `).join('');
}

// ---------- 删除操作（带二次确认）----------
function deleteBrand(id) {
  confirmDelete(() => {
    window.appData.brands = window.appData.brands.filter(b => b.id !== id);
    saveData();
    renderBrands();
  });
}

function deleteContent(key, id) {
  confirmDelete(() => {
    window.appData[key] = window.appData[key].filter(i => i.id !== id);
    saveData();
    renderContentArea();
  });
}

// ---------- 添加/编辑（管理员模式）----------
function addBrand() {
  const name = prompt('请输入品牌名称：');
  if (!name) return;
  window.appData.brands.push({ id: Date.now().toString(), name, codes: [] });
  saveData();
  renderBrands();
}

function editBrand(id) {
  const brand = window.appData.brands.find(b => b.id === id);
  if (!brand) return;
  const newName = prompt('修改品牌名称：', brand.name);
  if (newName && newName !== brand.name) {
    brand.name = newName;
    saveData();
    renderBrands();
  }
}

function openBrand(id) {
  const brand = window.appData.brands.find(b => b.id === id);
  if (!brand) return;
  // 进入品牌详情 —— 可扩展为独立视图，此处简化处理
  const codesStr = brand.codes.map(c => `${c.code} = ${c.definition}`).join('\n') || '暂无故障码';
  alert(`【${brand.name}】\n\n${codesStr}`);
}

// ============================================================
// Excel 导入 / 导出（使用 SheetJS）
// ============================================================

function exportExcel() {
  const rows = [];
  // 品牌 + 故障码
  window.appData.brands.forEach(b => {
    if (b.codes.length === 0) {
      rows.push({ 类型: '品牌', 品牌: b.name, 故障码: '', 定义: '' });
    } else {
      b.codes.forEach(c => {
        rows.push({ 类型: '品牌', 品牌: b.name, 故障码: c.code, 定义: c.definition });
      });
    }
  });
  // 收藏/经验/调试
  ['favorites', 'experiences', 'debug'].forEach(key => {
    (window.appData[key] || []).forEach(item => {
      rows.push({ 类型: key, 品牌: item.title, 故障码: '', 定义: item.content });
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '电梯维修数据');
  XLSX.writeFile(wb, '电梯维修助手_数据备份.xlsx');
}

function importExcel(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const wb = XLSX.read(e.target.result, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    const imported = { brands: [], favorites: [], experiences: [], debug: [] };
    const brandMap = {};

    rows.forEach(row => {
      if (row['类型'] === '品牌') {
        const bName = row['品牌'];
        if (!brandMap[bName]) {
          brandMap[bName] = { id: Date.now().toString() + Math.random(), name: bName, codes: [] };
          imported.brands.push(brandMap[bName]);
        }
        if (row['故障码']) {
          brandMap[bName].codes.push({
            id: Date.now().toString() + Math.random(),
            code: String(row['故障码']),
            definition: row['定义'] || ''
          });
        }
      } else if (['favorites', 'experiences', 'debug'].includes(row['类型'])) {
        imported[row['类型']].push({
          id: Date.now().toString() + Math.random(),
          title: row['品牌'],
          content: row['定义'] || ''
        });
      }
    });

    window.appData = imported;
    saveData();
    renderBrands();
    renderContentArea();
    alert('✅ 导入完成');
  };
  reader.readAsArrayBuffer(file);
}

// ---------- 绑定事件 ----------
function bindEvents() {
  bindHeaderLongPress();
  bindSearch();

  document.getElementById('adminConfirm').onclick = verifyAdminPassword;
  document.getElementById('adminCancel').onclick = () =>
    document.getElementById('adminModal').classList.remove('show');

  document.getElementById('addBtn').onclick = () => {
    if (currentTab === 'brands') addBrand();
    else {
      const title = prompt('请输入标题：');
      if (!title) return;
      const content = prompt('请输入内容：') || '';
      const keyMap = { favorites: 'favorites', experience: 'experiences', debug: 'debug' };
      window.appData[keyMap[currentTab]].push({
        id: Date.now().toString(), title, content
      });
      saveData();
      renderContentArea();
    }
  };

  document.querySelectorAll('.bottom-nav button').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });

  // 导出按钮（可在设置中加入）
  // 导入按钮通过 <input type="file"> 触发
}

// ---------- 启动 ----------
init();