let allMutations = [];
let editingId = null;
let currentFilter = { status: '', investigation_team: '', tree_age_min: '', tree_age_max: '' };
let currentUser = null;

function togglePwd(btn) {
  const input = btn.parentElement.querySelector('input');
  const isPwd = input.type === 'password';
  input.type = isPwd ? 'text' : 'password';
  btn.innerHTML = isPwd
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  btn.setAttribute('aria-label', isPwd ? '隐藏密码' : '显示密码');
}

function authHeaders() {
  const t = localStorage.getItem('auth_token');
  return t ? { 'x-auth-token': t } : {};
}

function handleUnauth() {
  localStorage.removeItem('auth_token');
  currentUser = null;
  showAuth();
  throw new Error('登录已过期');
}

const api = {
  async list(q, status, investigation_team, tree_age_min, tree_age_max) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (investigation_team) params.set('investigation_team', investigation_team);
    if (tree_age_min) params.set('tree_age_min', tree_age_min);
    if (tree_age_max) params.set('tree_age_max', tree_age_max);
    const url = params.toString() ? `/api/mutations?${params}` : '/api/mutations';
    const r = await fetch(url, { headers: authHeaders() });
    if (r.status === 401) handleUnauth();
    return r.json();
  },
  async get(id) {
    const r = await fetch(`/api/mutations/${id}`, { headers: authHeaders() });
    if (r.status === 401) handleUnauth();
    return r.json();
  },
  async save(data) {
    const r = await fetch('/api/mutations', { method: 'POST', headers: { ...authHeaders() }, body: data });
    return r.json();
  },
  async update(id, data) {
    const r = await fetch(`/api/mutations/${id}`, { method: 'PUT', headers: { ...authHeaders() }, body: data });
    return r.json();
  },
  async delete(id) {
    const r = await fetch(`/api/mutations/${id}`, { method: 'DELETE', headers: { ...authHeaders() } });
    return r.json();
  },
  async login(username, password) {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    return r.json();
  },
  async register(username, password) {
    const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    return r.json();
  },
  async getMe() {
    const r = await fetch('/api/auth/me', { headers: authHeaders() });
    return r.json();
  },
  async getStatuses() {
    const r = await fetch('/api/taxonomy/statuses', { headers: authHeaders() });
    if (r.status === 401) handleUnauth();
    return r.json();
  },
  async getInvestigationTeams() {
    const r = await fetch('/api/taxonomy/investigation-teams', { headers: authHeaders() });
    if (r.status === 401) handleUnauth();
    return r.json();
  },
  async getTreeAges() {
    const r = await fetch('/api/taxonomy/tree-ages', { headers: authHeaders() });
    if (r.status === 401) handleUnauth();
    return r.json();
  },
  async getStats() {
    const r = await fetch('/api/stats', { headers: authHeaders() });
    if (r.status === 401) handleUnauth();
    return r.json();
  },
  async getCustomFields() {
    const r = await fetch('/api/custom-fields', { headers: authHeaders() });
    if (r.status === 401) handleUnauth();
    return r.json();
  },
  async createCustomField(name) {
    const r = await fetch('/api/custom-fields', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    return r.json();
  },
  async updateCustomField(id, name) {
    const r = await fetch(`/api/custom-fields/${id}`, { method: 'PUT', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    return r.json();
  },
  async deleteCustomField(id) {
    const r = await fetch(`/api/custom-fields/${id}`, { method: 'DELETE', headers: { ...authHeaders() } });
    return r.json();
  },
  async getAdminUsers() {
    const r = await fetch('/api/admin/users', { headers: authHeaders() });
    if (r.status === 403) throw new Error('权限不足');
    return r.json();
  },
  async deleteAdminUser(id) {
    const r = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: { ...authHeaders() } });
    return r.json();
  },
  async updateUserPerm(id, body) {
    const r = await fetch(`/api/admin/users/${id}/permissions`, { method: 'PUT', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  },
  async getLogs(page, limit) {
    const r = await fetch('/api/admin/logs?page=' + (page||1) + '&limit=' + (limit||50), { headers: authHeaders() });
    if (r.status === 403) throw new Error('权限不足');
    return r.json();
  },
  async changePassword(old_password, new_password) {
    const r = await fetch('/api/auth/password', { method: 'PUT', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ old_password, new_password }) });
    return r.json();
  },
  async exportXlsx() {
    const r = await fetch('/api/export/xlsx', { headers: authHeaders() });
    if (r.status === 401) handleUnauth();
    if (!r.ok) throw new Error('导出失败');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `huaniu-mutation-export-${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast('导出成功');
  }
};

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2500);
}

function openChangePwdModal() {
  document.getElementById('changePwdModal').classList.remove('hidden');
  document.getElementById('changePwdOld').value = '';
  document.getElementById('changePwdNew').value = '';
  document.getElementById('changePwdConfirm').value = '';
  document.getElementById('changePwdError').textContent = '';
}

function closeChangePwdModal() {
  document.getElementById('changePwdModal').classList.add('hidden');
}

async function handleChangePwd() {
  const old_pw = document.getElementById('changePwdOld').value;
  const new_pw = document.getElementById('changePwdNew').value;
  const confirm = document.getElementById('changePwdConfirm').value;
  const errEl = document.getElementById('changePwdError');
  if (!old_pw || !new_pw) { errEl.textContent = '请填写完整'; return; }
  if (new_pw.length < 6) { errEl.textContent = '新密码至少6个字符'; return; }
  if (new_pw !== confirm) { errEl.textContent = '两次密码不一致'; return; }
  try {
    const res = await api.changePassword(old_pw, new_pw);
    if (res.error) { errEl.textContent = res.error; return; }
    toast('密码修改成功');
    closeChangePwdModal();
  } catch (e) { errEl.textContent = '修改失败'; }
}

function showAuth() {
  document.getElementById('authOverlay').classList.remove('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('authError').textContent = '';
  document.getElementById('authError2').textContent = '';
}

function hideAuth() {
  document.getElementById('authOverlay').classList.add('hidden');
}

function updateUIForRole() {
  const isAdmin = currentUser && currentUser.role === 'admin';
  document.getElementById('addBtn').classList.remove('hidden');
  document.getElementById('userMgmtBtn').classList.toggle('hidden', !isAdmin);
  document.getElementById('changePwdBtn').classList.remove('hidden');
  document.getElementById('logoutBtn').classList.remove('hidden');
  document.getElementById('exportBtn').classList.toggle('hidden', !isAdmin);
  document.getElementById('logBtn').classList.toggle('hidden', !isAdmin);
}

async function checkAuth() {
  const token = localStorage.getItem('auth_token');
  if (!token) { showAuth(); return false; }
  try {
    const data = await api.getMe();
    if (data.user) {
      currentUser = data.user;
      hideAuth();
      updateUIForRole();
      initializeApp();
      return true;
    }
  } catch (e) {}
  localStorage.removeItem('auth_token');
  showAuth();
  return false;
}

async function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('authError');
  if (!username || !password) { errEl.textContent = '请输入用户名和密码'; return; }
  try {
    const data = await api.login(username, password);
    if (data.error) { errEl.textContent = data.error; return; }
    localStorage.setItem('auth_token', data.token);
    currentUser = data.user;
    hideAuth();
    updateUIForRole();
    initializeApp();
  } catch (e) {
    errEl.textContent = '登录失败';
  }
}

async function handleRegister() {
  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;
  const confirm = document.getElementById('registerConfirm').value;
  const errEl = document.getElementById('authError2');
  if (!username || !password) { errEl.textContent = '请输入用户名和密码'; return; }
  if (!/^[\u4e00-\u9fa5]{2,}$/.test(username)) { errEl.textContent = '用户名至少2个汉字'; return; }
  if (password !== confirm) { errEl.textContent = '两次密码不一致'; return; }
  try {
    const data = await api.register(username, password);
    if (data.error) { errEl.textContent = data.error; return; }
    toast('注册成功，请登录');
    document.getElementById('registerUsername').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerConfirm').value = '';
    document.getElementById('showLoginBtn').click();
  } catch (e) { errEl.textContent = '注册失败'; }
}

function handleLogout() {
  localStorage.removeItem('auth_token');
  currentUser = null;
  document.getElementById('changePwdBtn').classList.add('hidden');
  document.getElementById('logoutBtn').classList.add('hidden');
  document.getElementById('addBtn').classList.remove('hidden');
  document.getElementById('userMgmtBtn').classList.add('hidden');
  document.getElementById('cardGrid').innerHTML = '';
  document.getElementById('emptyState').classList.add('hidden');
  showAuth();
}

document.getElementById('loginBtn').addEventListener('click', handleLogin);
document.getElementById('loginPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
document.getElementById('showRegisterBtn').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.remove('hidden');
});
document.getElementById('showLoginBtn').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
});
document.getElementById('registerBtn').addEventListener('click', handleRegister);
document.getElementById('registerConfirm').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleRegister(); });
document.getElementById('logoutBtn').addEventListener('click', handleLogout);
document.getElementById('changePwdBtn').addEventListener('click', openChangePwdModal);
document.getElementById('changePwdSubmit').addEventListener('click', handleChangePwd);
document.getElementById('changePwdConfirm').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleChangePwd(); });
document.getElementById('logBtn').addEventListener('click', openLogModal);
document.getElementById('exportBtn').addEventListener('click', async () => {
  try { await api.exportXlsx(); } catch (e) { toast(e.message); }
});

function initializeApp() {
  loadCards();
  loadSidebarTab('statuses');
}

function showLoading(show) {
  document.getElementById('loading').classList.toggle('hidden', !show);
}

async function loadCards(q) {
  showLoading(true);
  try {
    allMutations = await api.list(q || '', currentFilter.status, currentFilter.investigation_team, currentFilter.tree_age_min, currentFilter.tree_age_max);
    renderCards(allMutations);
  } catch (err) {
    toast('加载失败: ' + err.message);
  } finally {
    showLoading(false);
  }
}

function renderCards(data) {
  const grid = document.getElementById('cardGrid');
  const empty = document.getElementById('emptyState');
  const isAdmin = currentUser && currentUser.role === 'admin';

  if (!data || data.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = data.map(item => `
    <div class="card" onclick="showDetail(${item.id})">
      ${item.image_path
        ? `<img class="card-image" src="${item.image_path}" alt="${item.name}" loading="lazy">`
        : `<div class="card-image-placeholder">🍎</div>`}
      <div class="card-body">
        <h3>${esc(item.name)} ${item.status ? `<span class="status-badge status-${esc(item.status)}">${esc(item.status)}</span>` : ''}</h3>
        <div class="card-taxonomy">
          ${item.investigation_team ? `<span>${esc(item.investigation_team)}</span>` : ''}
        </div>
        ${item.rootstock_scion ? `<div style="font-size:12px;color:var(--gray-500);margin-bottom:6px;">🌱 ${esc(item.rootstock_scion)}</div>` : ''}
        <div class="card-info">
          ${item.orchard_type ? `<span>🌳 ${esc(item.orchard_type)}</span>` : ''}
        </div>
      </div>
      <div class="card-actions">
        <button class="btn btn-edit" onclick="event.stopPropagation(); openEdit(${item.id})">编辑</button>
        ${isAdmin ? `<button class="btn btn-delete" onclick="event.stopPropagation(); confirmDelete(${item.id})">删除</button>` : ''}
      </div>
    </div>
  `).join('');
}

function fmtTime(utcStr) {
  if (!utcStr) return '';
  try {
    const d = new Date(utcStr.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return utcStr;
    const opt = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    return d.toLocaleString(undefined, opt);
  } catch (e) { return utcStr; }
}

function esc(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function openModal(title, data) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalOverlay').classList.remove('hidden');
  switchSection('basic');
  loadCustomFieldsInputs(data ? data.custom_values : null);
  if (data) {
    editingId = data.id;
    document.getElementById('editId').value = data.id;
    document.getElementById('name').value = data.name || '';
    document.getElementById('rootstockScion').value = data.rootstock_scion || '';
    document.getElementById('mutationChars').value = data.mutation_chars || '';
    document.getElementById('orchardAddress').value = data.orchard_address || '';
    document.getElementById('villageName').value = data.village_name || '';
    document.getElementById('orchardManager').value = data.orchard_manager || '';
    document.getElementById('contactPhone').value = data.contact_phone || '';
    const otVal = data.orchard_type || '';
    const predefined = ['规模化种植园', '农户分散种植区', '山地果园', '川地果园', '特殊环境果园'];
    if (predefined.includes(otVal)) {
      document.getElementById('orchardType').value = otVal;
      document.getElementById('orchardTypeOther').style.display = 'none';
    } else if (otVal) {
      document.getElementById('orchardType').value = '其他';
      document.getElementById('orchardTypeOther').value = otVal;
      document.getElementById('orchardTypeOther').style.display = '';
    }
    const mvVal = data.main_variety || '';
    const mvPredefined = ['红元帅', '红星', '天汪一号', '超红星', '新红星', '首红', '新首红', '阿斯矮生', '俄矮2号', '瓦里短枝', '惠民短枝', '栽培2号', '玛斯特红蛇', '秦脆', '富士系', '嘎拉'];
    if (mvPredefined.includes(mvVal)) {
      document.getElementById('mainVariety').value = mvVal;
      document.getElementById('mainVarietyOther').style.display = 'none';
    } else if (mvVal) {
      document.getElementById('mainVariety').value = '其他';
      document.getElementById('mainVarietyOther').value = mvVal;
      document.getElementById('mainVarietyOther').style.display = '';
    }
    const ssVal = data.seedling_source || '';
    const ssPredefined = ['私人购买', '政府采购', '本地自育'];
    if (ssPredefined.includes(ssVal)) {
      document.getElementById('seedlingSource').value = ssVal;
      document.getElementById('seedlingSourceOther').style.display = 'none';
    } else if (ssVal) {
      document.getElementById('seedlingSource').value = '其他';
      document.getElementById('seedlingSourceOther').value = ssVal;
      document.getElementById('seedlingSourceOther').style.display = '';
    }
    document.getElementById('cultivationManagement').value = data.cultivation_management || '';
    const gruVal = data.growth_regulator_use || '';
    const gruPredefined = ['使用', '未使用', '不确定'];
    if (gruPredefined.includes(gruVal)) {
      document.getElementById('growthRegulatorUse').value = gruVal;
      document.getElementById('growthRegulatorUseOther').style.display = 'none';
    } else if (gruVal) {
      document.getElementById('growthRegulatorUse').value = '其他';
      document.getElementById('growthRegulatorUseOther').value = gruVal;
      document.getElementById('growthRegulatorUseOther').style.display = '';
    }
    const seVal = data.special_environment || '';
    const sePredefined = ['冻害', '雹灾', '干旱', '多雨', '辐射', '磁场', '无'];
    if (sePredefined.includes(seVal)) {
      document.getElementById('specialEnvironment').value = seVal;
      document.getElementById('specialEnvironmentOther').style.display = 'none';
    } else if (seVal) {
      document.getElementById('specialEnvironment').value = '其他';
      document.getElementById('specialEnvironmentOther').value = seVal;
      document.getElementById('specialEnvironmentOther').style.display = '';
    }
    memberNames = (data.investigation_members || '').split(',').filter(Boolean);
    renderMembers();
    document.getElementById('investigationTeam').value = data.investigation_team || '';
    document.getElementById('teamContact').value = data.team_contact || '';
    document.getElementById('treeAge').value = data.tree_age || '';
    document.getElementById('fruitingAge').value = data.fruiting_age || '';
    document.getElementById('treeVigor').value = data.tree_vigor || '';
    document.getElementById('fruitShape').value = data.fruit_shape || '';
    document.getElementById('fruitColor').value = data.fruit_color || '';
    document.getElementById('fruitSize').value = data.fruit_size || '';
    document.getElementById('fruitIndex').value = data.fruit_index || '';
    document.getElementById('solubleSolids').value = data.soluble_solids || '';
    document.getElementById('firmness').value = data.firmness || '';
    document.getElementById('leafChars').value = data.leaf_chars || '';
    document.getElementById('branchChars').value = data.branch_chars || '';
    document.getElementById('phenophase').value = data.phenophase || '';
    document.getElementById('diseaseResistance').value = data.disease_resistance || '';
    document.getElementById('yieldPerf').value = data.yield_perf || '';
    document.getElementById('stressResistance').value = data.stress_resistance || '';
    document.getElementById('pestResistance').value = data.pest_resistance || '';
    document.getElementById('longitude').value = data.longitude || '';
    document.getElementById('latitude').value = data.latitude || '';
    document.getElementById('altitude').value = data.altitude || '';
    if (data.image_path) {
      document.getElementById('imagePreview').innerHTML = `<img src="${data.image_path}" alt="preview">`;
    } else {
      document.getElementById('imagePreview').innerHTML = '';
    }
    if (data.location_image) {
      document.getElementById('locationImagePreview').innerHTML = `<img src="${data.location_image}" alt="preview">`;
    } else {
      document.getElementById('locationImagePreview').innerHTML = '';
    }
    const statusRadios = document.querySelectorAll('input[name="status"]');
    statusRadios.forEach(r => r.checked = r.value === (data.status || '母本果园调研中'));
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.getElementById('mutationForm').reset();
  document.getElementById('editId').value = '';
  document.getElementById('imagePreview').innerHTML = '';
  document.getElementById('locationImagePreview').innerHTML = '';
  document.getElementById('orchardType').value = '';
  document.getElementById('orchardTypeOther').value = '';
  document.getElementById('orchardTypeOther').style.display = 'none';
  document.getElementById('mainVariety').value = '';
  document.getElementById('mainVarietyOther').value = '';
  document.getElementById('mainVarietyOther').style.display = 'none';
  document.getElementById('seedlingSource').value = '';
  document.getElementById('seedlingSourceOther').value = '';
  document.getElementById('seedlingSourceOther').style.display = 'none';
  document.getElementById('growthRegulatorUse').value = '';
  document.getElementById('growthRegulatorUseOther').value = '';
  document.getElementById('growthRegulatorUseOther').style.display = 'none';
  document.getElementById('specialEnvironment').value = '';
  document.getElementById('specialEnvironmentOther').value = '';
  document.getElementById('specialEnvironmentOther').style.display = 'none';
  memberNames = [];
  renderMembers();
  document.getElementById('investigationMemberInput').value = '';
  editingId = null;
  switchSection('basic');
}

function handlePrint() {
  document.querySelectorAll('#section-basic .print-select-list').forEach(el => el.remove());
  document.querySelectorAll('#section-basic select').forEach(select => {
    const container = select.closest('.form-group');
    if (!container) return;
    const list = document.createElement('div');
    list.className = 'print-select-list';
    Array.from(select.options).forEach(o => {
      if (!o.value && !o.text) return;
      const item = document.createElement('div');
      item.textContent = (o.selected ? '☑ ' : '☐ ') + o.text;
      if (o.selected) item.style.fontWeight = 'bold';
      list.appendChild(item);
    });
    const otherInput = container.querySelector('.orchard-type-other');
    if (otherInput && otherInput.value) {
      const item = document.createElement('div');
      item.textContent = '✏ 已填写: ' + otherInput.value;
      item.style.cssText = 'margin-top:4px;font-style:italic;color:#555';
      list.appendChild(item);
    }
    container.appendChild(list);
  });
  window.print();
}

document.getElementById('addBtn').addEventListener('click', () => {
  openModal('添加芽变');
});

document.getElementById('mutationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData();
  fd.append('name', document.getElementById('name').value.trim());
  fd.append('rootstock_scion', document.getElementById('rootstockScion').value.trim());
  fd.append('mutation_chars', document.getElementById('mutationChars').value.trim());
  fd.append('orchard_address', document.getElementById('orchardAddress').value.trim());
  fd.append('village_name', document.getElementById('villageName').value.trim());
  fd.append('orchard_manager', document.getElementById('orchardManager').value.trim());
  fd.append('contact_phone', document.getElementById('contactPhone').value.trim());
  const ot = document.getElementById('orchardType').value;
  fd.append('orchard_type', ot === '其他' ? document.getElementById('orchardTypeOther').value.trim() : ot);
  const mv = document.getElementById('mainVariety').value;
  fd.append('main_variety', mv === '其他' ? document.getElementById('mainVarietyOther').value.trim() : mv);
  const ss = document.getElementById('seedlingSource').value;
  fd.append('seedling_source', ss === '其他' ? document.getElementById('seedlingSourceOther').value.trim() : ss);
  const gru = document.getElementById('growthRegulatorUse').value;
  fd.append('growth_regulator_use', gru === '其他' ? document.getElementById('growthRegulatorUseOther').value.trim() : gru);
  const se = document.getElementById('specialEnvironment').value;
  fd.append('special_environment', se === '其他' ? document.getElementById('specialEnvironmentOther').value.trim() : se);
  fd.append('cultivation_management', document.getElementById('cultivationManagement').value.trim());
  fd.append('investigation_members', memberNames.join(','));
  fd.append('investigation_team', document.getElementById('investigationTeam').value.trim());
  fd.append('team_contact', document.getElementById('teamContact').value.trim());
  fd.append('tree_age', document.getElementById('treeAge').value.trim());
  fd.append('fruiting_age', document.getElementById('fruitingAge').value.trim());
  fd.append('tree_vigor', document.getElementById('treeVigor').value.trim());
  fd.append('fruit_shape', document.getElementById('fruitShape').value.trim());
  fd.append('fruit_color', document.getElementById('fruitColor').value.trim());
  fd.append('fruit_size', document.getElementById('fruitSize').value.trim());
  fd.append('fruit_index', document.getElementById('fruitIndex').value.trim());
  fd.append('soluble_solids', document.getElementById('solubleSolids').value.trim());
  fd.append('firmness', document.getElementById('firmness').value.trim());
  fd.append('leaf_chars', document.getElementById('leafChars').value.trim());
  fd.append('branch_chars', document.getElementById('branchChars').value.trim());
  fd.append('phenophase', document.getElementById('phenophase').value.trim());
  fd.append('disease_resistance', document.getElementById('diseaseResistance').value.trim());
  fd.append('yield_perf', document.getElementById('yieldPerf').value.trim());
  fd.append('status', document.querySelector('input[name="status"]:checked')?.value || '母本果园调研中');
  fd.append('stress_resistance', document.getElementById('stressResistance').value.trim());
  fd.append('pest_resistance', document.getElementById('pestResistance').value.trim());
  fd.append('longitude', document.getElementById('longitude').value.trim());
  fd.append('latitude', document.getElementById('latitude').value.trim());
  fd.append('altitude', document.getElementById('altitude').value.trim());

  const img = document.getElementById('image');
  if (img.files[0]) fd.append('image', img.files[0]);

  const locImg = document.getElementById('locationImage');
  if (locImg.files[0]) fd.append('location_image', locImg.files[0]);

  const customInputs = document.querySelectorAll('.custom-field-input');
  const customValues = {};
  customInputs.forEach(inp => {
    if (inp.value.trim()) customValues[inp.dataset.fieldId] = inp.value.trim();
  });
  if (Object.keys(customValues).length > 0) {
    fd.append('custom_values', JSON.stringify(customValues));
  }

  try {
    let res;
    if (editingId) {
      res = await api.update(editingId, fd);
    } else {
      res = await api.save(fd);
    }
    if (res.error) { toast(res.error); return; }
    toast(editingId ? '更新成功' : '添加成功');
    closeModal();
    loadCards();
    loadCurrentTab();
  } catch (err) {
    toast('操作失败: ' + err.message);
  }
});

document.getElementById('getLocationBtn').addEventListener('click', async () => {
  if (!navigator.geolocation) { toast('浏览器不支持地理定位'); return; }
  const btn = document.getElementById('getLocationBtn');
  btn.disabled = true; btn.innerHTML = '定位中...';
  try {
    const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 }));
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    document.getElementById('longitude').value = lng.toFixed(6);
    document.getElementById('latitude').value = lat.toFixed(6);
    document.getElementById('altitude').value = pos.coords.altitude ? pos.coords.altitude.toFixed(1) : '';
    btn.innerHTML = '获取信息中...';

    if (!pos.coords.altitude) {
      try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 8000);
        const el = await fetch(`/api/geo/elevation?lat=${lat}&lon=${lng}`, { signal: ac.signal });
        clearTimeout(t);
        const ej = await el.json();
        if (ej.results && ej.results[0] && ej.results[0].elevation != null) {
          document.getElementById('altitude').value = ej.results[0].elevation.toFixed(1);
        }
      } catch (e) { /* elevation optional */ }
    }
    toast('定位成功');
  } catch (err) {
    if (err.name === 'AbortError') { toast('获取位置信息超时，请重试'); }
    else { toast('定位失败: ' + (err.code === 1 ? '请允许定位权限' : err.message)); }
  } finally {
    btn.disabled = false; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> 获取当前位置';
  }
});

document.getElementById('image').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) { document.getElementById('imagePreview').innerHTML = ''; return; }
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById('imagePreview').innerHTML = `<img src="${ev.target.result}" alt="preview">`;
  };
  reader.readAsDataURL(file);
});

document.getElementById('locationImage').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) { document.getElementById('locationImagePreview').innerHTML = ''; return; }
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById('locationImagePreview').innerHTML = `<img src="${ev.target.result}" alt="preview">`;
  };
  reader.readAsDataURL(file);
});

  document.getElementById('orchardType').addEventListener('change', (e) => {
  document.getElementById('orchardTypeOther').style.display = e.target.value === '其他' ? '' : 'none';
});

document.getElementById('mainVariety').addEventListener('change', (e) => {
  document.getElementById('mainVarietyOther').style.display = e.target.value === '其他' ? '' : 'none';
});

document.getElementById('seedlingSource').addEventListener('change', (e) => {
  document.getElementById('seedlingSourceOther').style.display = e.target.value === '其他' ? '' : 'none';
});

document.getElementById('growthRegulatorUse').addEventListener('change', (e) => {
  document.getElementById('growthRegulatorUseOther').style.display = e.target.value === '其他' ? '' : 'none';
});

document.getElementById('specialEnvironment').addEventListener('change', (e) => {
  document.getElementById('specialEnvironmentOther').style.display = e.target.value === '其他' ? '' : 'none';
});

let memberNames = [];
function renderMembers() {
  const el = document.getElementById('memberList');
  if (!el) return;
  el.innerHTML = memberNames.map((m, i) => `<span class="member-tag">${esc(m)}<span class="member-tag-remove" data-index="${i}">×</span></span>`).join('');
}
(function() {
  const ml = document.getElementById('memberList');
  const ab = document.getElementById('addMemberBtn');
  const mi = document.getElementById('investigationMemberInput');
  if (ml) ml.addEventListener('click', function(e) {
    var btn = e.target.closest('.member-tag-remove');
    if (btn) { memberNames.splice(parseInt(btn.dataset.index), 1); renderMembers(); }
  });
  if (ab) ab.addEventListener('click', function() {
    if (!mi) return;
    var name = mi.value.trim();
    if (!name || memberNames.indexOf(name) !== -1) return;
    memberNames.push(name);
    mi.value = '';
    renderMembers();
  });
  if (mi) mi.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); if (ab) ab.click(); }
  });
})();

async function showDetail(id) {
  try {
    const data = await api.get(id);
    document.getElementById('detailTitle').textContent = data.name;
    const detailSections = [];
    const basicItems = ['name', 'rootstock_scion', 'mutation_chars', 'orchard_address', 'village_name', 'orchard_manager', 'contact_phone', 'orchard_type', 'main_variety', 'tree_age', 'fruiting_age', 'seedling_source', 'cultivation_management', 'growth_regulator_use', 'special_environment', 'investigation_team', 'investigation_members', 'team_contact'].filter(k => data[k]);
    detailSections.push(`
      ${data.image_path || data.location_image || data.status ? `<div class="detail-meta" style="margin-bottom:12px">
        ${data.image_path ? `<div style="grid-column:1/-1"><img src="${data.image_path}" alt="${esc(data.name)}" style="max-height:200px;object-fit:contain;border-radius:var(--radius);background:var(--gray-100);width:100%"></div>` : ''}
        ${data.location_image ? `<div><strong>果园位置图：</strong><div style="margin-top:4px"><img src="${data.location_image}" alt="位置图" style="max-height:200px;object-fit:contain;border-radius:var(--radius);background:var(--gray-100);width:100%"></div></div>` : ''}
        ${data.status ? `<div class="detail-meta-item"><div class="label">状态</div><div class="value">${esc(data.status)}</div></div>` : ''}
      </div>` : ''}
      ${basicItems.length > 0 ? `<div class="detail-section"><h3>基本信息</h3><div class="detail-meta">
        ${data.name ? `<div class="detail-meta-item"><div class="label">芽变品种（系）编号</div><div class="value">${esc(data.name)}</div></div>` : ''}
        ${data.rootstock_scion ? `<div class="detail-meta-item"><div class="label">母本砧穗组合</div><div class="value">${esc(data.rootstock_scion)}</div></div>` : ''}
        ${data.mutation_chars ? `<div class="detail-meta-item" style="grid-column:1/-1"><div class="label">芽变特征</div><div class="value">${esc(data.mutation_chars)}</div></div>` : ''}
        ${data.orchard_address ? `<div class="detail-meta-item"><div class="label">果园地址</div><div class="value">${esc(data.orchard_address)}</div></div>` : ''}
        ${data.longitude || data.latitude || data.altitude ? `<div class="detail-meta-item" style="grid-column:1/-1"><div class="label">地理位置</div><div class="value">${[data.longitude ? '经度:'+esc(data.longitude) : '', data.latitude ? '纬度:'+esc(data.latitude) : '', data.altitude ? '海拔:'+esc(data.altitude)+'m' : ''].filter(Boolean).join(' | ')}</div></div>` : ''}
        ${data.village_name ? `<div class="detail-meta-item"><div class="label">村名或合作社</div><div class="value">${esc(data.village_name)}</div></div>` : ''}
        ${data.orchard_manager ? `<div class="detail-meta-item"><div class="label">果园负责人</div><div class="value">${esc(data.orchard_manager)}</div></div>` : ''}
        ${data.contact_phone ? `<div class="detail-meta-item"><div class="label">联系电话</div><div class="value">${esc(data.contact_phone)}</div></div>` : ''}
        ${data.orchard_type ? `<div class="detail-meta-item"><div class="label">果园类型</div><div class="value">${esc(data.orchard_type)}</div></div>` : ''}
        ${data.main_variety ? `<div class="detail-meta-item"><div class="label">主栽品种</div><div class="value">${esc(data.main_variety)}</div></div>` : ''}
        ${data.tree_age ? `<div class="detail-meta-item"><div class="label">树龄 (年)</div><div class="value">${esc(data.tree_age)}</div></div>` : ''}
        ${data.fruiting_age ? `<div class="detail-meta-item"><div class="label">始果年龄 (a)</div><div class="value">${esc(data.fruiting_age)}</div></div>` : ''}
        ${data.seedling_source ? `<div class="detail-meta-item"><div class="label">苗木来源</div><div class="value">${esc(data.seedling_source)}</div></div>` : ''}
        ${data.cultivation_management ? `<div class="detail-meta-item" style="grid-column:1/-1"><div class="label">栽培管理情况</div><div class="value">${esc(data.cultivation_management)}</div></div>` : ''}
        ${data.growth_regulator_use ? `<div class="detail-meta-item" style="grid-column:1/-1"><div class="label">植物生长调节剂使用情况</div><div class="value">${esc(data.growth_regulator_use)}</div></div>` : ''}
        ${data.special_environment ? `<div class="detail-meta-item" style="grid-column:1/-1"><div class="label">特殊环境</div><div class="value">${esc(data.special_environment)}</div></div>` : ''}
        ${data.investigation_team ? `<div class="detail-meta-item"><div class="label">调查组</div><div class="value">${esc(data.investigation_team)}</div></div>` : ''}
        ${data.investigation_members ? `<div class="detail-meta-item"><div class="label">调查成员</div><div class="value">${esc(data.investigation_members)}</div></div>` : ''}
        ${data.team_contact ? `<div class="detail-meta-item"><div class="label">联系电话</div><div class="value">${esc(data.team_contact)}</div></div>` : ''}
      </div></div>` : ''}
    `);
    const morphItems = [data.tree_vigor, data.branch_chars, data.leaf_chars, data.yield_perf].filter(Boolean);
    if (morphItems.length > 0) {
      detailSections.push(`<div class="detail-section"><h3>形态特征与生物学特性</h3>
        ${data.tree_vigor ? `<p><strong>树势：</strong>${esc(data.tree_vigor)}</p>` : ''}
        ${data.branch_chars ? `<p><strong>枝条性状：</strong>${esc(data.branch_chars)}</p>` : ''}
        ${data.leaf_chars ? `<p><strong>叶片性状：</strong>${esc(data.leaf_chars)}</p>` : ''}
        ${data.yield_perf ? `<p><strong>丰产性：</strong>${esc(data.yield_perf)}</p>` : ''}
      </div>`);
    }
    if (data.phenophase) {
      detailSections.push(`<div class="detail-section"><h3>物候期</h3><p>${esc(data.phenophase)}</p></div>`);
    }
    const fruitItems = [data.fruit_shape, data.fruit_color, data.fruit_size, data.fruit_index, data.soluble_solids, data.firmness].filter(Boolean);
    if (fruitItems.length > 0) {
      detailSections.push(`<div class="detail-section"><h3>果实品质特性</h3>
        <div class="detail-meta">
          ${data.fruit_shape ? `<div class="detail-meta-item"><div class="label">果形</div><div class="value">${esc(data.fruit_shape)}</div></div>` : ''}
          ${data.fruit_color ? `<div class="detail-meta-item"><div class="label">色泽</div><div class="value">${esc(data.fruit_color)}</div></div>` : ''}
          ${data.fruit_size ? `<div class="detail-meta-item"><div class="label">果实大小(g)</div><div class="value">${esc(data.fruit_size)}</div></div>` : ''}
          ${data.fruit_index ? `<div class="detail-meta-item"><div class="label">果形指数</div><div class="value">${esc(data.fruit_index)}</div></div>` : ''}
          ${data.soluble_solids ? `<div class="detail-meta-item"><div class="label">可溶性固形物(%)</div><div class="value">${esc(data.soluble_solids)}</div></div>` : ''}
          ${data.firmness ? `<div class="detail-meta-item"><div class="label">硬度(kg/cm²)</div><div class="value">${esc(data.firmness)}</div></div>` : ''}
        </div>
      </div>`);
    }
    if (data.stress_resistance) {
      detailSections.push(`<div class="detail-section"><h3>抗逆性</h3><p>${esc(data.stress_resistance)}</p></div>`);
    }
    const pestItems = [data.disease_resistance, data.pest_resistance].filter(Boolean);
    if (pestItems.length > 0) {
      detailSections.push(`<div class="detail-section"><h3>抗病虫性</h3>
        ${data.disease_resistance ? `<p><strong>抗病性：</strong>${esc(data.disease_resistance)}</p>` : ''}
        ${data.pest_resistance ? `<p><strong>抗虫性：</strong>${esc(data.pest_resistance)}</p>` : ''}
      </div>`);
    }
    document.getElementById('detailBody').innerHTML = detailSections.join('');
    document.getElementById('detailModal').classList.remove('hidden');
  } catch (err) {
    toast('加载失败: ' + err.message);
  }
}

function closeDetail() {
  document.getElementById('detailModal').classList.add('hidden');
}

async function openEdit(id) {
  try {
    const data = await api.get(id);
    openModal('编辑芽变', data);
  } catch (err) {
    toast('加载失败: ' + err.message);
  }
}

function showConfirm(msg) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmMessage').textContent = msg;
    modal.classList.remove('hidden');
    const ok = document.getElementById('confirmOk');
    const cancel = document.getElementById('confirmCancel');
    const cleanup = result => {
      modal.classList.add('hidden');
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
  });
}

async function confirmDelete(id) {
  if (!await showConfirm('确定要删除此芽变记录吗？')) return;
  try {
    const res = await api.delete(id);
    if (res.error) { toast(res.error); return; }
    toast('删除成功');
    loadCards();
    loadCurrentTab();
  } catch (err) {
    toast('删除失败: ' + err.message);
  }
}

document.getElementById('searchBtn').addEventListener('click', () => {
  loadCards(document.getElementById('searchInput').value.trim());
});

document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadCards(e.target.value.trim());
});

// Section tab navigation
const sectionOrder = ['basic', 'morph', 'phenophase', 'fruit', 'stress', 'pest'];

function switchSection(sectionId) {
  document.querySelectorAll('.section-content').forEach(el => el.classList.add('hidden'));
  document.getElementById('section-' + sectionId).classList.remove('hidden');
  document.querySelectorAll('.section-tab').forEach(el => el.classList.remove('active'));
  document.querySelector(`.section-tab[data-section="${sectionId}"]`).classList.add('active');
  const idx = sectionOrder.indexOf(sectionId);
  document.getElementById('prevSection').style.display = idx === 0 ? 'none' : '';
  document.getElementById('nextSection').style.display = idx === sectionOrder.length - 1 ? 'none' : '';
}

document.getElementById('sectionTabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.section-tab');
  if (tab) switchSection(tab.dataset.section);
});

document.getElementById('prevSection').addEventListener('click', () => {
  const active = document.querySelector('.section-tab.active');
  if (!active) return;
  const idx = sectionOrder.indexOf(active.dataset.section);
  if (idx > 0) switchSection(sectionOrder[idx - 1]);
});

document.getElementById('nextSection').addEventListener('click', () => {
  const active = document.querySelector('.section-tab.active');
  if (!active) return;
  const idx = sectionOrder.indexOf(active.dataset.section);
  if (idx < sectionOrder.length - 1) switchSection(sectionOrder[idx + 1]);
});

// 遮罩层点击不关闭弹窗，防止误操作丢失表单数据

document.getElementById('detailModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeDetail();
});

// Sidebar
const sidebar = document.getElementById('taxonomySidebar');

function isMobile() {
  return window.innerWidth <= 768;
}

function openSidebar() {
  sidebar.classList.add('open');
  document.getElementById('sidebarBackdrop').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  sidebar.classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('show');
  document.body.style.overflow = '';
}

document.getElementById('sidebarOpenBtn').addEventListener('click', openSidebar);
document.getElementById('sidebarCloseBtn').addEventListener('click', closeSidebar);
document.getElementById('sidebarBackdrop').addEventListener('click', closeSidebar);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
});

window.addEventListener('resize', () => {
  if (!isMobile() && sidebar.classList.contains('open')) closeSidebar();
});

// Auto-close sidebar on mobile after filter selection
function closeSidebarIfMobile() {
  if (isMobile()) closeSidebar();
}

document.getElementById('sidebarToggleBtn').addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
});

document.querySelectorAll('.sidebar-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadSidebarTab(tab.dataset.tab);
  });
});

function loadSidebarTab(tab) {
  const body = document.getElementById('taxonomyBody');
  body.innerHTML = '<div class="taxonomy-loading">加载中...</div>';
  if (tab === 'statuses') loadStatuses();
  else if (tab === 'investigation-teams') loadInvestigationTeams();
  else if (tab === 'tree-ages') loadTreeAges();
}

async function loadStatuses() {
  const body = document.getElementById('taxonomyBody');
  try {
    const statuses = await api.getStatuses();
    if (statuses.length === 0) {
      body.innerHTML = '<div class="taxonomy-loading">暂无状态数据</div>';
      return;
    }
    body.innerHTML = `<div class="taxonomy-flat-list">
      ${statuses.map(s => `
        <button class="taxonomy-flat-item${currentFilter.status === s ? ' active' : ''}" data-value="${esc(s)}">🔘 ${esc(s)}</button>
      `).join('')}
    </div>`;
    body.querySelectorAll('.taxonomy-flat-item').forEach(el => {
      el.addEventListener('click', () => {
        setFilter('status', el.dataset.value);
      });
    });
  } catch (err) {
    body.innerHTML = '<div class="taxonomy-loading">加载失败</div>';
  }
}

async function loadInvestigationTeams() {
  const body = document.getElementById('taxonomyBody');
  try {
    const teams = await api.getInvestigationTeams();
    if (teams.length === 0) {
      body.innerHTML = '<div class="taxonomy-loading">暂无调查组数据</div>';
      return;
    }
    body.innerHTML = `<div class="taxonomy-flat-list">
      ${teams.map(t => `
        <button class="taxonomy-flat-item${currentFilter.investigation_team === t ? ' active' : ''}" data-value="${esc(t)}">👥 ${esc(t)}</button>
      `).join('')}
    </div>`;
    body.querySelectorAll('.taxonomy-flat-item').forEach(el => {
      el.addEventListener('click', () => {
        setFilter('investigation_team', el.dataset.value);
      });
    });
  } catch (err) {
    body.innerHTML = '<div class="taxonomy-loading">加载失败</div>';
  }
}

async function loadTreeAges() {
  const body = document.getElementById('taxonomyBody');
  try {
    const ages = await api.getTreeAges();
    if (ages.length === 0) {
      body.innerHTML = '<div class="taxonomy-loading">暂无树龄数据</div>';
      return;
    }
    body.innerHTML = `<div class="taxonomy-flat-list">
      ${ages.map(a => {
        const active = currentFilter.tree_age_min === a.min && currentFilter.tree_age_max === a.max ? ' active' : '';
        return `<button class="taxonomy-flat-item${active}" data-min="${a.min}" data-max="${a.max}">🌳 ${esc(a.age_range)}</button>`;
      }).join('')}
    </div>`;
    body.querySelectorAll('.taxonomy-flat-item').forEach(el => {
      el.addEventListener('click', () => {
        const min = el.dataset.min;
        const max = el.dataset.max;
        if (currentFilter.tree_age_min === min && currentFilter.tree_age_max === max) {
          currentFilter.tree_age_min = '';
          currentFilter.tree_age_max = '';
        } else {
          currentFilter.tree_age_min = min;
          currentFilter.tree_age_max = max;
        }
        updateFilterUI();
        loadCards(document.getElementById('searchInput').value.trim());
        loadCurrentTab();
        closeSidebarIfMobile();
      });
    });
  } catch (err) {
    body.innerHTML = '<div class="taxonomy-loading">加载失败</div>';
  }
}

function setFilter(key, value) {
  if (currentFilter[key] === value) {
    currentFilter[key] = '';
  } else {
    currentFilter[key] = value;
  }
  updateFilterUI();
  loadCards(document.getElementById('searchInput').value.trim());
  loadCurrentTab();
  closeSidebarIfMobile();
}

function updateFilterUI() {
  const el = document.getElementById('currentFilter');
  const text = document.getElementById('filterText');
  const clearTaxonomy = document.getElementById('clearTaxonomy');
  const parts = [];
  if (currentFilter.status) parts.push(`状态：${currentFilter.status}`);
  if (currentFilter.investigation_team) parts.push(`调查组：${currentFilter.investigation_team}`);
  if (currentFilter.tree_age_min !== '' && currentFilter.tree_age_max !== '') {
    const t = currentFilter.tree_age_min === '0' ? '0年' : currentFilter.tree_age_max === '999' ? `${currentFilter.tree_age_min}年以上` : `${currentFilter.tree_age_min}-${currentFilter.tree_age_max}年`;
    parts.push(`树龄：${t}`);
  }
  if (parts.length > 0) {
    el.classList.remove('hidden');
    clearTaxonomy.classList.remove('hidden');
    text.textContent = parts.join(' | ');
  } else {
    el.classList.add('hidden');
    clearTaxonomy.classList.add('hidden');
  }
}

function loadCurrentTab() {
  const active = document.querySelector('.sidebar-tab.active');
  if (active) loadSidebarTab(active.dataset.tab);
}

document.getElementById('clearFilterBtn').addEventListener('click', () => {
  currentFilter = { status: '', investigation_team: '', tree_age_min: '', tree_age_max: '' };
  updateFilterUI();
  loadCards();
  loadCurrentTab();
});

document.getElementById('clearTaxonomy').addEventListener('click', () => {
  currentFilter = { status: '', investigation_team: '', tree_age_min: '', tree_age_max: '' };
  updateFilterUI();
  loadCards();
  loadCurrentTab();
});

// Custom Fields
async function loadCustomFieldsInputs(customValues) {
  const container = document.getElementById('customFieldsContainer');
  try {
    const fields = await api.getCustomFields();
    if (fields.length === 0) {
      container.innerHTML = '<div class="custom-fields-empty">暂无自定义项目，点击"管理"添加</div>';
      return;
    }
    container.innerHTML = fields.map(f => `
      <div class="form-group">
        <label>${esc(f.name)}</label>
        <input type="text" class="custom-field-input" data-field-id="${f.id}" value="${esc(customValues && customValues[f.id] ? customValues[f.id] : '')}" placeholder="请输入${esc(f.name)}">
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div class="custom-fields-empty">加载失败</div>';
  }
}

document.getElementById('manageCustomFieldsBtn').addEventListener('click', () => {
  document.getElementById('customFieldsModal').classList.remove('hidden');
  loadCustomFieldsList();
});

function closeCustomFieldsModal() {
  document.getElementById('customFieldsModal').classList.add('hidden');
}

async function loadCustomFieldsList() {
  const list = document.getElementById('customFieldsList');
  try {
    const fields = await api.getCustomFields();
    if (fields.length === 0) {
      list.innerHTML = '<div class="custom-fields-empty" style="padding:20px;text-align:center;color:var(--gray-400)">暂无自定义项目</div>';
      return;
    }
    list.innerHTML = fields.map(f => `
      <div class="custom-field-row">
        <input type="text" class="custom-field-edit" data-id="${f.id}" value="${esc(f.name)}">
        <button class="btn btn-sm btn-save-field" data-id="${f.id}">保存</button>
        <button class="btn btn-sm btn-delete-field" data-id="${f.id}">删除</button>
      </div>
    `).join('');
    list.querySelectorAll('.btn-save-field').forEach(btn => {
      btn.addEventListener('click', async () => {
        const inp = btn.parentElement.querySelector('.custom-field-edit');
        const name = inp.value.trim();
        if (!name) return;
        await api.updateCustomField(btn.dataset.id, name);
        loadCustomFieldsList();
      });
    });
    list.querySelectorAll('.btn-delete-field').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!await showConfirm('确定删除此自定义项目？关联数据也将清除。')) return;
        await api.deleteCustomField(btn.dataset.id);
        loadCustomFieldsList();
        loadCustomFieldsInputs();
      });
    });
  } catch (err) {
    list.innerHTML = '<div class="custom-fields-empty" style="padding:20px;text-align:center;color:var(--gray-400)">加载失败</div>';
  }
}

document.getElementById('addCustomFieldBtn').addEventListener('click', async () => {
  const inp = document.getElementById('newCustomFieldName');
  const name = inp.value.trim();
  if (!name) return;
  await api.createCustomField(name);
  inp.value = '';
  loadCustomFieldsList();
});

document.getElementById('newCustomFieldName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('addCustomFieldBtn').click();
});

// Stats
document.getElementById('statsBtn').addEventListener('click', openStats);

function closeStats() {
  document.getElementById('statsModal').classList.add('hidden');
}

async function openStats() {
  document.getElementById('statsModal').classList.remove('hidden');
  const body = document.getElementById('statsBody');
  try {
    const stats = await api.getStats();
    body.innerHTML = renderStats(stats);
  } catch (err) {
    body.innerHTML = `<div class="taxonomy-loading">加载失败: ${err.message}</div>`;
  }
}

function renderStats(stats) {
  const maxStatus = stats.byStatus.length > 0 ? stats.byStatus[0].count : 1;
  const maxTeam = stats.byTeam.length > 0 ? stats.byTeam[0].count : 1;
  const maxOrchard = stats.byOrchardType.length > 0 ? stats.byOrchardType[0].count : 1;
  const maxAge = stats.byTreeAge.length > 0 ? stats.byTreeAge[0].count : 1;

  return `
    <div class="stats-summary">
      <div class="stats-card"><div class="stats-card-value">${stats.total}</div><div class="stats-card-label">🍎 芽变总数</div></div>
    </div>

    <div class="stats-charts">
      <div class="stats-chart">
        <h4>按状态分布</h4>
        <div class="chart-row"><div class="chart-col chart-col-bar">${renderBarChart(stats.byStatus, 'status', maxStatus)}</div><div class="chart-col chart-col-pie">${renderPieChart(stats.byStatus, 'status')}</div></div>
      </div>
      <div class="stats-chart">
        <h4>按调查组分布</h4>
        <div class="chart-row"><div class="chart-col chart-col-bar">${renderBarChart(stats.byTeam, 'investigation_team', maxTeam)}</div><div class="chart-col chart-col-pie">${renderPieChart(stats.byTeam, 'investigation_team')}</div></div>
      </div>
      <div class="stats-chart">
        <h4>按果园类型分布</h4>
        <div class="chart-row"><div class="chart-col chart-col-bar">${renderBarChart(stats.byOrchardType, 'orchard_type', maxOrchard)}</div><div class="chart-col chart-col-pie">${renderPieChart(stats.byOrchardType, 'orchard_type')}</div></div>
      </div>
      <div class="stats-chart">
        <h4>按树龄分布</h4>
        <div class="chart-row"><div class="chart-col chart-col-bar">${renderBarChart(stats.byTreeAge, 'age_range', maxAge)}</div><div class="chart-col chart-col-pie">${renderPieChart(stats.byTreeAge, 'age_range')}</div></div>
      </div>
    </div>
  `;
}

const CHART_COLORS = [
  '#e04444', '#f07575', '#f7a5a5', '#8a7db8',
  '#f0ad20', '#5cc490', '#b8a0cc', '#d8b090',
  '#6cc4a0', '#e0b8b0', '#a0c090', '#d098b0'
];

function renderBarChart(data, nameField, max) {
  if (data.length === 0) return '<div class="stats-empty">暂无数据</div>';
  return `<div class="bar-chart">
    ${data.map((item, i) => {
      const pct = (item.count / max * 100).toFixed(1);
      const c = CHART_COLORS[i % CHART_COLORS.length];
      return `
        <div class="bar-row">
          <div class="bar-label" title="${esc(item[nameField])}">${esc(item[nameField])}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%;background:${c}"></div>
          </div>
          <div class="bar-value">${item.count}</div>
        </div>
      `;
    }).join('')}
  </div>`;
}

function renderPieChart(data, nameField) {
  if (data.length === 0) return '<div class="stats-empty">暂无数据</div>';
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return '<div class="stats-empty">暂无数据</div>';

  const n = data.length;
  const sectorAngle = (2 * Math.PI) / n;
  const maxCount = Math.max(...data.map(d => d.count));
  const cx = 80, cy = 80, maxR = 68, minR = 14;
  const gap = 0.02;

  let paths = '';
  let legend = '';

  data.forEach((item, i) => {
    const r = minR + (item.count / maxCount) * (maxR - minR);
    const a1 = -Math.PI / 2 + i * sectorAngle + gap;
    const a2 = -Math.PI / 2 + (i + 1) * sectorAngle - gap;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    const color = CHART_COLORS[i % CHART_COLORS.length];

    paths += `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 0,1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${color}" stroke="#fff" stroke-width="1.2"/>`;

    const pct = (item.count / total * 100).toFixed(1);
    legend += `<div class="pie-legend-item"><span class="pie-dot" style="background:${color}"></span>${esc(item[nameField])} <span class="pie-value">${item.count} (${pct}%)</span></div>`;
  });

  return `<div class="pie-chart-wrapper">
    <svg viewBox="0 0 160 160" class="pie-svg">${paths}</svg>
    <div class="pie-legend">${legend}</div>
  </div>`;
}

// Admin
document.getElementById('userMgmtBtn').addEventListener('click', openUserMgmt);

function closeUserMgmt() {
  document.getElementById('userMgmtModal').classList.add('hidden');
}

async function openUserMgmt() {
  document.getElementById('userMgmtModal').classList.remove('hidden');
  const body = document.getElementById('userMgmtBody');
  try {
    const users = await api.getAdminUsers();
    body.innerHTML = `<table class="user-table">
      <thead><tr><th>ID</th><th>用户名</th><th>角色</th><th>注册时间</th><th>操作</th></tr></thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td>${u.id}</td>
            <td>${esc(u.username)}</td>
            <td>${u.role === 'admin' ? '管理员' : '普通用户'}</td>
            <td>${fmtTime(u.created_at)}</td>
            <td>${u.role !== 'admin' ? `<button class="btn btn-sm btn-delete-field" onclick="adminDeleteUser(${u.id})">删除</button>` : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
  } catch (err) {
    body.innerHTML = `<div class="taxonomy-loading">${err.message}</div>`;
  }
}

async function adminDeleteUser(id) {
  if (!await showConfirm('确定删除此用户？')) return;
  try {
    const res = await api.deleteAdminUser(id);
    if (res.error) { toast(res.error); return; }
    toast('删除成功');
    openUserMgmt();
  } catch (err) {
    toast('删除失败');
  }
}

function closeLogModal() {
  document.getElementById('logModal').classList.add('hidden');
}

async function openLogModal() {
  document.getElementById('logModal').classList.remove('hidden');
  const body = document.getElementById('logBody');
  try {
    const data = await api.getLogs(1, 100);
    if (data.logs.length === 0) {
      body.innerHTML = '<div class="taxonomy-loading">暂无操作记录</div>';
      return;
    }
    body.innerHTML = '<table class="user-table"><thead><tr><th>时间</th><th>用户</th><th>操作</th><th>目标</th><th>详情</th></tr></thead><tbody>'
      + data.logs.map(l => '<tr><td>'
        + fmtTime(l.created_at) + '</td><td>'
        + esc(l.username || '系统') + '</td><td>'
        + esc(l.action) + '</td><td>'
        + esc(l.target_type) + ' #' + l.target_id + '</td><td>'
        + esc(l.detail || '-') + '</td></tr>').join('')
      + '</tbody></table>';
  } catch (err) {
    body.innerHTML = '<div class="taxonomy-loading">' + err.message + '</div>';
  }
}

checkAuth();
