const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

function registerRoutes(app, deps) {
  const { query, queryOne, execute, logOperation, DATA_DIR, upload, computeHash, adminOnly, canEdit, canUpload, verifyToken, createToken } = deps;

app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    if (!/^[\u4e00-\u9fa5]{2,}$/.test(username)) return res.status(400).json({ error: '用户名至少2个汉字' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少6个字符' });
    const existing = queryOne(`SELECT id FROM users WHERE username = ?`, [username]);
    if (existing) return res.status(400).json({ error: '用户名已存在' });
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    execute(`INSERT INTO users (username, password_hash, salt, role, can_edit, can_upload) VALUES (?, ?, ?, 'user', 1, 1)`, [username, hash, salt]);
    res.json({ message: '注册成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    const user = queryOne(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!user) return res.status(401).json({ error: '用户名或密码错误' });
    const hash = crypto.pbkdf2Sync(password, user.salt, 10000, 64, 'sha512').toString('hex');
    if (hash !== user.password_hash) return res.status(401).json({ error: '用户名或密码错误' });
    const token = createToken({ id: user.id, username: user.username, role: user.role, can_edit: user.can_edit, can_upload: user.can_upload });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, can_edit: !!user.can_edit, can_upload: !!user.can_upload } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (!token) return res.json({ user: null });
  const payload = verifyToken(token);
  if (!payload) return res.json({ user: null });
  res.json({ user: { id: payload.id, username: payload.username, role: payload.role, can_edit: payload.can_edit, can_upload: payload.can_upload } });
});

app.put('/api/auth/password', (req, res) => {
  try {
    const token = req.headers['x-auth-token'];
    if (!token) return res.status(401).json({ error: '请先登录' });
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: '登录已过期' });
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) return res.status(400).json({ error: '请填写旧密码和新密码' });
    if (new_password.length < 6) return res.status(400).json({ error: '新密码至少6个字符' });
    const user = queryOne(`SELECT * FROM users WHERE id = ?`, [payload.id]);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const oldHash = crypto.pbkdf2Sync(old_password, user.salt, 10000, 64, 'sha512').toString('hex');
    if (oldHash !== user.password_hash) return res.status(400).json({ error: '旧密码错误' });
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(new_password, salt, 10000, 64, 'sha512').toString('hex');
    execute(`UPDATE users SET password_hash=?, salt=? WHERE id=?`, [hash, salt, payload.id]);
    res.json({ message: '密码修改成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/') || req.path.startsWith('/geo/')) return next();
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: '请先登录' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: '登录已过期' });
  req.user = payload;
  next();
});

app.get('/api/admin/logs', adminOnly, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;
    const logs = query(`SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]);
    const total = queryOne(`SELECT COUNT(*) as count FROM operation_logs`).count;
    res.json({ logs, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', adminOnly, (req, res) => {
  try {
    const users = query(`SELECT id, username, role, can_edit, can_upload, created_at FROM users ORDER BY id`);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id/permissions', adminOnly, (req, res) => {
  try {
    const user = queryOne(`SELECT * FROM users WHERE id = ?`, [req.params.id]);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (user.role === 'admin') return res.status(400).json({ error: '不能修改管理员权限' });
    const { can_edit, can_upload } = req.body;
    execute(`UPDATE users SET can_edit=?, can_upload=? WHERE id=?`, [can_edit ? 1 : 0, can_upload ? 1 : 0, req.params.id]);
    res.json({ message: '权限更新成功' }); logOperation(req.user.id, req.user.username, '修改权限', '用户', req.params.id, JSON.stringify(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', adminOnly, (req, res) => {
  try {
    const user = queryOne(`SELECT * FROM users WHERE id = ?`, [req.params.id]);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (user.id === req.user.id) return res.status(400).json({ error: '不能删除自己' });
    if (user.role === 'admin') return res.status(400).json({ error: '不能删除管理员' });
    execute(`DELETE FROM users WHERE id = ?`, [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/mutations', (req, res) => {
  try {
    const { q, status, investigation_team, tree_age_min, tree_age_max } = req.query;
    let sql = 'SELECT * FROM mutations WHERE 1=1';
    const params = [];
    if (q) {
      sql += ' AND name LIKE ?';
      params.push(`%${q}%`);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (investigation_team) {
      sql += ' AND investigation_team = ?';
      params.push(investigation_team);
    }
    if (tree_age_min !== undefined && tree_age_min !== '') {
      sql += ' AND CAST(tree_age AS INTEGER) >= ?';
      params.push(parseInt(tree_age_min));
    }
    if (tree_age_max !== undefined && tree_age_max !== '') {
      sql += ' AND CAST(tree_age AS INTEGER) <= ?';
      params.push(parseInt(tree_age_max));
    }
    sql += ' ORDER BY updated_at DESC';
    const rows = query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/taxonomy/statuses', (req, res) => {
  try {
    const rows = query(`SELECT status, COUNT(*) as cnt FROM mutations WHERE status != '' GROUP BY status ORDER BY cnt DESC, status`);
    res.json(rows.map(r => r.status));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/taxonomy/investigation-teams', (req, res) => {
  try {
    const rows = query(`SELECT investigation_team, COUNT(*) as cnt FROM mutations WHERE investigation_team != '' GROUP BY investigation_team ORDER BY cnt DESC, investigation_team`);
    res.json(rows.map(r => r.investigation_team));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/taxonomy/tree-ages', (req, res) => {
  try {
    const rows = query(`SELECT bucket, COUNT(*) as count FROM (SELECT CASE WHEN CAST(tree_age AS INTEGER) = 0 THEN '0' WHEN CAST(tree_age AS INTEGER) >= 31 THEN '31' ELSE CAST(((CAST(tree_age AS INTEGER) - 1) / 5) * 5 + 1 AS TEXT) END AS bucket FROM mutations WHERE tree_age != '' AND tree_age IS NOT NULL AND CAST(tree_age AS INTEGER) >= 0) GROUP BY bucket ORDER BY CAST(bucket AS INTEGER)`);
    const result = rows.map(r => {
      let age_range, min, max;
      if (r.bucket === '0') {
        age_range = '0年'; min = '0'; max = '0';
      } else if (r.bucket === '31') {
        age_range = '30年以上'; min = '31'; max = '999';
      } else {
        const start = parseInt(r.bucket);
        age_range = `${start}-${start + 4}年`; min = String(start); max = String(start + 4);
      }
      return { age_range, min, max, count: r.count };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/custom-fields', (req, res) => {
  try {
    const fields = query(`SELECT * FROM custom_fields ORDER BY id`);
    res.json(fields);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/custom-fields', adminOnly, (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '名称不能为空' });
    execute(`INSERT INTO custom_fields (name) VALUES (?)`, [name.trim()]);
    const last = queryOne(`SELECT MAX(id) as id FROM custom_fields`);
    res.json({ id: last.id, message: '添加成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/custom-fields/:id', adminOnly, (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '名称不能为空' });
    execute(`UPDATE custom_fields SET name=? WHERE id=?`, [name.trim(), req.params.id]);
    res.json({ message: '更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/custom-fields/:id', adminOnly, (req, res) => {
  try {
    execute(`DELETE FROM mutation_custom_values WHERE field_id=?`, [req.params.id]);
    execute(`DELETE FROM custom_fields WHERE id=?`, [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const total = queryOne(`SELECT COUNT(*) as count FROM mutations`).count;
    const byStatus = query(`SELECT status, COUNT(*) as count FROM mutations WHERE status != '' GROUP BY status ORDER BY count DESC`);
    const byTeam = query(`SELECT investigation_team, COUNT(*) as count FROM mutations WHERE investigation_team != '' GROUP BY investigation_team ORDER BY count DESC`);
    const byOrchardType = query(`SELECT orchard_type, COUNT(*) as count FROM mutations WHERE orchard_type != '' GROUP BY orchard_type ORDER BY count DESC`);
    const byTreeAge = query(`SELECT bucket, COUNT(*) as count FROM (SELECT CASE WHEN CAST(tree_age AS INTEGER) = 0 THEN '0' WHEN CAST(tree_age AS INTEGER) >= 31 THEN '31' ELSE CAST(((CAST(tree_age AS INTEGER) - 1) / 5) * 5 + 1 AS TEXT) END AS bucket FROM mutations WHERE tree_age != '' AND tree_age IS NOT NULL AND CAST(tree_age AS INTEGER) >= 0) GROUP BY bucket ORDER BY CAST(bucket AS INTEGER)`);
    byTreeAge.forEach(r => { r.age_range = r.bucket === '0' ? '0年' : r.bucket === '31' ? '30年以上' : `${r.bucket}-${parseInt(r.bucket) + 4}年`; });
    res.json({ total, byStatus, byTeam, byOrchardType, byTreeAge });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/mutations/:id', (req, res) => {
  try {
    const row = queryOne(`SELECT * FROM mutations WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: '未找到' });
    const custom = query(`SELECT mcv.field_id, mcv.value, cf.name FROM mutation_custom_values mcv JOIN custom_fields cf ON mcv.field_id=cf.id WHERE mcv.mutation_id=?`, [req.params.id]);
    row.custom_values = {};
    for (const c of custom) {
      row.custom_values[c.field_id] = c.value;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mutations', canUpload, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'location_image', maxCount: 1 }]), async (req, res) => {
  try {
    const { name, tree_age, fruiting_age, tree_vigor, fruit_shape, fruit_color, fruit_size, soluble_solids, firmness, leaf_chars, branch_chars, phenophase, disease_resistance, status, fruit_index, yield_perf, stress_resistance, pest_resistance, rootstock_scion, mutation_chars, orchard_address, village_name, orchard_manager, contact_phone, orchard_type, main_variety, seedling_source, cultivation_management, growth_regulator_use, special_environment, investigation_team, investigation_members, team_contact, longitude, latitude, altitude, custom_values } = req.body;
    if (!name) return res.status(400).json({ error: '名称不能为空' });
    let image_path = '';
    let image_hash = '';
    if (req.files.image?.[0]) {
      image_path = '/uploads/' + req.files.image[0].filename;
      image_hash = await computeHash(req.files.image[0].path);
    }
    let location_image = '';
    if (req.files.location_image?.[0]) {
      location_image = '/uploads/' + req.files.location_image[0].filename;
    }
    execute(
      `INSERT INTO mutations (name, tree_age, fruiting_age, tree_vigor, fruit_shape, fruit_color, fruit_size, soluble_solids, firmness, leaf_chars, branch_chars, phenophase, disease_resistance, status, fruit_index, yield_perf, stress_resistance, pest_resistance, rootstock_scion, mutation_chars, orchard_address, village_name, orchard_manager, contact_phone, orchard_type, main_variety, seedling_source, cultivation_management, growth_regulator_use, special_environment, investigation_team, investigation_members, team_contact, longitude, latitude, altitude, image_path, image_hash, location_image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, tree_age || '', fruiting_age || '', tree_vigor || '', fruit_shape || '', fruit_color || '', fruit_size || '', soluble_solids || '', firmness || '', leaf_chars || '', branch_chars || '', phenophase || '', disease_resistance || '', status || '母本果园调研中', fruit_index || '', yield_perf || '', stress_resistance || '', pest_resistance || '', rootstock_scion || '', mutation_chars || '', orchard_address || '', village_name || '', orchard_manager || '', contact_phone || '', orchard_type || '', main_variety || '', seedling_source || '', cultivation_management || '', growth_regulator_use || '', special_environment || '', investigation_team || '', investigation_members || '', team_contact || '', longitude || '', latitude || '', altitude || '', image_path, image_hash, location_image]
    );
    const last = queryOne(`SELECT MAX(id) as id FROM mutations`);
    let parsedCustom = {};
    if (custom_values) {
      try { parsedCustom = JSON.parse(custom_values); } catch (e) { parsedCustom = {}; }
    }
    if (Object.keys(parsedCustom).length > 0) {
      for (const [fid, val] of Object.entries(parsedCustom)) {
        if (val) execute(`INSERT INTO mutation_custom_values (mutation_id, field_id, value) VALUES (?, ?, ?)`, [last.id, fid, val]);
      }
    }
    res.json({ id: last.id, message: '添加成功' }); logOperation(req.user.id, req.user.username, '创建', '芽变', last.id, name);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/mutations/:id', canEdit, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'location_image', maxCount: 1 }]), async (req, res) => {
  try {
    const { name, tree_age, fruiting_age, tree_vigor, fruit_shape, fruit_color, fruit_size, soluble_solids, firmness, leaf_chars, branch_chars, phenophase, disease_resistance, status, fruit_index, yield_perf, stress_resistance, pest_resistance, rootstock_scion, mutation_chars, orchard_address, village_name, orchard_manager, contact_phone, orchard_type, main_variety, seedling_source, cultivation_management, growth_regulator_use, special_environment, investigation_team, investigation_members, team_contact, longitude, latitude, altitude, custom_values } = req.body;
    if (!name) return res.status(400).json({ error: '名称不能为空' });
    const existing = queryOne(`SELECT image_path, location_image FROM mutations WHERE id = ?`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: '未找到' });
    let setClauses = [`name=?`, `tree_age=?`, `fruiting_age=?`, `tree_vigor=?`, `fruit_shape=?`, `fruit_color=?`, `fruit_size=?`, `soluble_solids=?`, `firmness=?`, `leaf_chars=?`, `branch_chars=?`, `phenophase=?`, `disease_resistance=?`, `status=?`, `fruit_index=?`, `yield_perf=?`, `stress_resistance=?`, `pest_resistance=?`, `rootstock_scion=?`, `mutation_chars=?`, `orchard_address=?`, `village_name=?`, `orchard_manager=?`, `contact_phone=?`, `orchard_type=?`, `main_variety=?`, `seedling_source=?`, `cultivation_management=?`, `growth_regulator_use=?`, `special_environment=?`, `investigation_team=?`, `investigation_members=?`, `team_contact=?`, `longitude=?`, `latitude=?`, `altitude=?`, `updated_at=datetime('now')`];
    let params = [name, tree_age||'', fruiting_age||'', tree_vigor||'', fruit_shape||'', fruit_color||'', fruit_size||'', soluble_solids||'', firmness||'', leaf_chars||'', branch_chars||'', phenophase||'', disease_resistance||'', status||'母本果园调研中', fruit_index||'', yield_perf||'', stress_resistance||'', pest_resistance||'', rootstock_scion||'', mutation_chars||'', orchard_address||'', village_name||'', orchard_manager||'', contact_phone||'', orchard_type||'', main_variety||'', seedling_source||'', cultivation_management||'', growth_regulator_use||'', special_environment||'', investigation_team||'', investigation_members||'', team_contact||'', longitude||'', latitude||'', altitude||''];
    if (req.files.image?.[0]) {
      const image_path = '/uploads/' + req.files.image[0].filename;
      const image_hash = await computeHash(req.files.image[0].path);
      setClauses.push(`image_path=?`, `image_hash=?`);
      params.push(image_path, image_hash);
      if (existing.image_path) {
        const oldPath = path.join(DATA_DIR, existing.image_path.replace(/^\//, ''));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }
    if (req.files.location_image?.[0]) {
      const location_image = '/uploads/' + req.files.location_image[0].filename;
      setClauses.push(`location_image=?`);
      params.push(location_image);
      if (existing.location_image) {
        const oldPath = path.join(DATA_DIR, existing.location_image.replace(/^\//, ''));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }
    params.push(req.params.id);
    execute(`UPDATE mutations SET ${setClauses.join(', ')} WHERE id=?`, params);
    let parsedCustom = {};
    if (custom_values) {
      try { parsedCustom = JSON.parse(custom_values); } catch (e) { parsedCustom = {}; }
    }
    if (Object.keys(parsedCustom).length > 0) {
      execute(`DELETE FROM mutation_custom_values WHERE mutation_id=?`, [req.params.id]);
      for (const [fid, val] of Object.entries(parsedCustom)) {
        if (val) execute(`INSERT INTO mutation_custom_values (mutation_id, field_id, value) VALUES (?, ?, ?)`, [req.params.id, fid, val]);
      }
    }
    res.json({ message: '更新成功' }); logOperation(req.user.id, req.user.username, '更新', '芽变', req.params.id, name);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mutations/:id', adminOnly, (req, res) => {
  try {
    const row = queryOne(`SELECT image_path, location_image, name FROM mutations WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: '未找到' });
    [row.image_path, row.location_image].forEach(p => {
      if (p) { const fp = path.join(DATA_DIR, p.replace(/^\//, '')); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
    });
    execute(`DELETE FROM mutation_custom_values WHERE mutation_id = ?`, [req.params.id]);
    execute(`DELETE FROM mutations WHERE id = ?`, [req.params.id]);
    logOperation(req.user.id, req.user.username, '删除', '芽变', req.params.id, row.name);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/geo/elevation', (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: '缺少经纬度参数' });
  const https = require('https');
  const url = `https://api.open-elevation.com/api/v1/lookup?locations=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`;
  const r = https.get(url, (resp) => {
    let data = '';
    resp.on('data', c => data += c);
    resp.on('end', () => {
      try { res.json(JSON.parse(data)); }
      catch (e) { res.status(502).json({ error: '解析失败' }); }
    });
  });
  r.setTimeout(8000, () => { r.destroy(); res.status(504).json({ error: '高程查询超时' }); });
  r.on('error', (e) => res.status(502).json({ error: e.message }));
});

app.get('/api/admin/uploads-list', adminOnly, (req, res) => {
  try {
    const rows = query(`SELECT DISTINCT image_path, location_image FROM mutations WHERE image_path != '' OR location_image != ''`);
    const files = [];
    for (const r of rows) {
      if (r.image_path) files.push(r.image_path.replace(/^\//, ''));
      if (r.location_image) files.push(r.location_image.replace(/^\//, ''));
    }
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/db-download', adminOnly, (req, res) => {
  try {
    const dbPath = path.join(DATA_DIR, 'mutations.db');
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: '数据库文件不存在' });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=mutations.db');
    const stream = fs.createReadStream(dbPath);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export/xlsx', adminOnly, (req, res) => {
  try {
    const XLSX = require('xlsx');
    const mutations = query('SELECT * FROM mutations ORDER BY updated_at DESC');
    const customFields = query('SELECT * FROM custom_fields ORDER BY id');
    const fieldNames = customFields.map(f => f.name);

    const headers = [
      'ID', '芽变品种（系）编号', '母本砧穗组合', '芽变特征',
      '果园地址', '经度', '纬度', '海拔', '村名或合作社（企业）名称', '果园负责人', '联系电话',
      '果园类型', '主栽品种', '树龄(年)', '始果年龄(a)', '苗木来源', '栽培管理情况',
      '植物生长调节剂使用情况', '特殊环境',
      '调查组', '调查成员', '联系电话',
      '树势', '果形', '色泽', '果实大小(g)', '可溶性固形物(%)',
      '硬度', '果形指数', '叶片性状', '枝条性状', '物候期',
      '抗病性', '抗虫性', '抗逆性', '丰产性', '状态',
      ...fieldNames,
      '创建时间', '更新时间'
    ];

    const rows = [headers];
    for (const m of mutations) {
      const customVals = query('SELECT cf.name, mcv.value FROM mutation_custom_values mcv JOIN custom_fields cf ON mcv.field_id=cf.id WHERE mcv.mutation_id=?', [m.id]);
      const customMap = {};
      for (const cv of customVals) customMap[cv.name] = cv.value;

      rows.push([
        m.id, m.name, m.rootstock_scion, m.mutation_chars,
        m.orchard_address, m.longitude, m.latitude, m.altitude, m.village_name, m.orchard_manager, m.contact_phone,
        m.orchard_type, m.main_variety, m.tree_age, m.fruiting_age, m.seedling_source,
        m.cultivation_management, m.growth_regulator_use, m.special_environment,
        m.investigation_team, m.investigation_members, m.team_contact,
        m.tree_vigor, m.fruit_shape, m.fruit_color, m.fruit_size,
        m.soluble_solids, m.firmness, m.fruit_index, m.leaf_chars, m.branch_chars, m.phenophase,
        m.disease_resistance, m.pest_resistance, m.stress_resistance, m.yield_perf, m.status,
        ...fieldNames.map(fn => customMap[fn] || ''),
        m.created_at, m.updated_at
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '芽变数据');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = 'huaniu-mutation-export-' + new Date().toISOString().slice(0,10) + '.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + encodeURIComponent(filename));
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

}

module.exports = registerRoutes;
