let products = [];
let editingId = null;
let uploadedImages = [];

async function checkAuth() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (data.authenticated) {
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('dashboard').classList.add('active');
      initDashboard();
    }
  } catch {}
}

async function handleLogin() {
  const password = document.getElementById('passwordInput').value;
  const err = document.getElementById('loginError');
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('dashboard').classList.add('active');
      initDashboard();
    } else {
      err.textContent = data.error || 'Contraseña incorrecta';
      err.classList.add('show');
    }
  } catch {
    err.textContent = 'Error de conexión con el servidor';
    err.classList.add('show');
  }
}

document.getElementById('passwordInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});

// ─── Tabs ───
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

async function initDashboard() {
  await loadProducts();
  renderTable();
  loadGalleryAdmin();
  loadReviewsAdmin();
}

// ════════════════════════════════════════════
// PRODUCTS
// ════════════════════════════════════════════

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    products = await res.json();
  } catch { products = []; }
}

function renderTable() {
  const tbody = document.querySelector('#productTable tbody');
  if (!products.length) {
    tbody.innerHTML = '<tr class="empty"><td colspan="6">No hay artículos todavía.</td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => {
    const images = parseImages(p);
    const thumb = images.length > 0
      ? `<img class="thumb" src="${escHtml(images[0])}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22%3E%3Crect fill=%22%23f0eee9%22 width=%2248%22 height=%2248%22/%3E%3C/svg%3E'">`
      : '<div class="thumb" style="background:#f0eee9;border-radius:4px"></div>';
    return `
      <tr>
        <td>${thumb}</td>
        <td><strong>${escHtml(p.title)}</strong></td>
        <td>${escHtml(p.category)}</td>
        <td>$${escHtml(p.price)} COP</td>
        <td>${images.length}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline" onclick="editProduct('${p.id}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">Eliminar</button>
        </td>
      </tr>`;
  }).join('');
}

function parseImages(p) {
  if (!p.images) return [];
  try {
    const parsed = JSON.parse(p.images);
    return Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
  } catch {
    return p.images ? [p.images] : [];
  }
}

// ─── Product form ───
function showForm(product) {
  document.getElementById('productForm').classList.add('active');
  document.getElementById('formTitle').textContent = product ? 'Editar artículo' : 'Nuevo artículo';
  document.getElementById('titleInput').value = product ? product.title : '';
  document.getElementById('priceInput').value = product ? product.price : '';
  document.getElementById('categoryInput').value = product ? product.category : '';
  document.getElementById('descInput').value = product ? product.description : '';

  if (product) {
    uploadedImages = parseImages(product);
  } else {
    uploadedImages = [];
  }
  renderImageList();
  editingId = product ? product.id : null;
  document.getElementById('productForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideForm() {
  document.getElementById('productForm').classList.remove('active');
  document.getElementById('productForm').querySelectorAll('input, textarea, select').forEach(el => el.value = '');
  uploadedImages = [];
  renderImageList();
  editingId = null;
}

async function uploadImages() {
  const files = document.getElementById('imageFiles').files;
  if (!files.length) return alert('Selecciona una o más fotos');

  for (const file of files) {
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error();
      const data = await res.json();
      uploadedImages.push(data.url);
    } catch {
      alert('Error al subir ' + file.name);
    }
  }
  renderImageList();
  document.getElementById('imageFiles').value = '';
}

function renderImageList() {
  const container = document.getElementById('imageList');
  if (!uploadedImages.length) {
    container.innerHTML = '<p style="color:var(--muted);font-size:0.8rem">Sin fotos aún</p>';
    return;
  }
  container.innerHTML = uploadedImages.map((url, i) =>
    `<div class="image-item">
      <img src="${escHtml(url)}" onerror="this.outerHTML='<span style=color:var(--red)>Error</span>'">
      <button class="image-remove" onclick="removeImage(${i})">&times;</button>
    </div>`
  ).join('');
}

function removeImage(index) {
  uploadedImages.splice(index, 1);
  renderImageList();
}

async function saveProduct() {
  const title = document.getElementById('titleInput').value.trim();
  const price = document.getElementById('priceInput').value.trim();
  const category = document.getElementById('categoryInput').value.trim();
  const description = document.getElementById('descInput').value.trim();

  if (!title || !category || !price) {
    return alert('Completa: título, categoría y precio.');
  }

  const body = { title, price, category, description, images: uploadedImages };

  try {
    const url = editingId ? `/api/products/${editingId}` : '/api/products';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 401) { alert('Sesión expirada.'); location.reload(); return; }
    if (!res.ok) { alert('Error al guardar'); return; }
    hideForm();
    await loadProducts();
    renderTable();
  } catch { alert('Error de conexión'); }
}

async function editProduct(id) {
  try {
    const res = await fetch(`/api/products/${id}`);
    if (!res.ok) return;
    showForm(await res.json());
  } catch { alert('Error'); }
}

async function deleteProduct(id) {
  if (!confirm('¿Eliminar este artículo?')) return;
  try {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.status === 401) { alert('Sesión expirada.'); location.reload(); return; }
    if (!res.ok) { alert('Error al eliminar'); return; }
    await loadProducts();
    renderTable();
  } catch { alert('Error'); }
}

async function handleLogout() {
  await fetch('/api/logout', { method: 'POST' });
  location.reload();
}

// ════════════════════════════════════════════
// GALLERY
// ════════════════════════════════════════════

async function loadGalleryAdmin() {
  const grid = document.getElementById('galleryAdminGrid');
  try {
    const res = await fetch('/api/gallery');
    if (!res.ok) throw new Error();
    const items = await res.json();
    if (!items.length) {
      grid.innerHTML = '<p style="color:var(--muted)">No hay imágenes en la galería.</p>';
      return;
    }
    grid.innerHTML = items.map(item =>
      `<div class="gallery-admin-item">
        <img src="${escHtml(item.url)}" loading="lazy">
        <button class="image-remove" onclick="deleteGalleryItem('${item.id}')">&times;</button>
      </div>`
    ).join('');
  } catch {
    grid.innerHTML = '<p style="color:var(--red)">Error al cargar galería.</p>';
  }
}

async function uploadGalleryImages() {
  const files = document.getElementById('galleryFiles').files;
  if (!files.length) return alert('Selecciona una o más fotos');

  const fd = new FormData();
  for (const file of files) fd.append('images', file);

  try {
    const res = await fetch('/api/gallery/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error();
    await loadGalleryAdmin();
    document.getElementById('galleryFiles').value = '';
  } catch {
    alert('Error al subir a galería');
  }
}

async function deleteGalleryItem(id) {
  if (!confirm('¿Eliminar esta imagen de la galería?')) return;
  try {
    const res = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    await loadGalleryAdmin();
  } catch { alert('Error'); }
}

// ════════════════════════════════════════════
// REVIEWS
// ════════════════════════════════════════════

async function loadReviewsAdmin() {
  const tbody = document.querySelector('#reviewTable tbody');
  try {
    const res = await fetch('/api/reviews');
    if (!res.ok) throw new Error();
    const items = await res.json();
    if (!items.length) {
      tbody.innerHTML = '<tr class="empty"><td colspan="5">No hay reseñas.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(r => {
      const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      const date = new Date(r.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
      return `<tr>
        <td><strong>${escHtml(r.name)}</strong></td>
        <td style="color:var(--gold)">${stars}</td>
        <td style="font-size:0.8rem;color:var(--muted)">${escHtml(r.comment)}</td>
        <td style="font-size:0.75rem">${date}</td>
        <td class="actions"><button class="btn btn-sm btn-danger" onclick="deleteReview('${r.id}')">Eliminar</button></td>
      </tr>`;
    }).join('');
  } catch {
    tbody.innerHTML = '<tr class="empty"><td colspan="5">Error al cargar.</td></tr>';
  }
}

function showReviewForm() {
  document.getElementById('reviewForm').classList.add('active');
  document.getElementById('reviewForm').scrollIntoView({ behavior: 'smooth' });
}

function hideReviewForm() {
  document.getElementById('reviewForm').classList.remove('active');
  document.getElementById('reviewForm').querySelectorAll('input, textarea, select').forEach(el => el.value = '');
}

async function saveReview() {
  const name = document.getElementById('reviewName').value.trim();
  const rating = Number(document.getElementById('reviewRating').value);
  const comment = document.getElementById('reviewComment').value.trim();
  if (!name || !comment) return alert('Nombre y comentario requeridos');

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rating, comment })
    });
    if (!res.ok) throw new Error();
    hideReviewForm();
    await loadReviewsAdmin();
  } catch { alert('Error al guardar'); }
}

async function deleteReview(id) {
  if (!confirm('¿Eliminar esta reseña?')) return;
  try {
    const res = await fetch(`/api/reviews/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    await loadReviewsAdmin();
  } catch { alert('Error'); }
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

checkAuth();
