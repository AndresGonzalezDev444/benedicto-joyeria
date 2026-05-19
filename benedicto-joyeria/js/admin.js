let products = [];
let editingId = null;

// ─── Auth ───
async function checkAuth() {
    try {
        const res = await fetch('/api/me');
        const data = await res.json();
        if (data.authenticated) {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('dashboard').classList.add('active');
            initDashboard();
        }
    } catch (e) {
        // Server not running
    }
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
    } catch (e) {
        err.textContent = 'Error de conexión con el servidor';
        err.classList.add('show');
    }
}

document.getElementById('passwordInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
});

// ─── Dashboard ───
async function initDashboard() {
    await loadProducts();
    renderTable();
}

async function loadProducts() {
    try {
        const res = await fetch('/api/products');
        products = await res.json();
    } catch (e) {
        products = [];
    }
}

async function renderTable() {
    await loadProducts();
    const tbody = document.querySelector('#productTable tbody');
    if (!products.length) {
        tbody.innerHTML = `<tr class="empty"><td colspan="6">No hay artículos todavía. ¡Agrega el primero!</td></tr>`;
        return;
    }
    tbody.innerHTML = products.map(p => `
        <tr>
            <td><img class="thumb" src="${escHtml(p.image)}" alt="" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22%3E%3Crect fill=%22%23f0eee9%22 width=%2248%22 height=%2248%22/%3E%3Ctext x=%2224%22 y=%2232%22 text-anchor=%22middle%22 fill=%22%238e8e8e%22 font-size=%2220%22%3E📷%3C/text%3E%3C/svg%3E'"></td>
            <td><strong>${escHtml(p.title)}</strong></td>
            <td>${escHtml(p.category)}</td>
            <td>$${escHtml(p.price)}</td>
            <td style="color:var(--muted);font-size:0.8rem">${escHtml(p.description)}</td>
            <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="editProduct('${p.id}')">Editar</button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

// ─── Form ───
function showForm(product) {
    const form = document.getElementById('productForm');
    form.classList.add('active');
    document.getElementById('formTitle').textContent = product ? 'Editar artículo' : 'Nuevo artículo';
    document.getElementById('titleInput').value = product ? product.title : '';
    document.getElementById('imageInput').value = product ? product.image : '';
    document.getElementById('categoryInput').value = product ? product.category : '';
    document.getElementById('priceInput').value = product ? product.price : '';
    document.getElementById('descriptionInput').value = product ? product.description : '';
    editingId = product ? product.id : null;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideForm() {
    document.getElementById('productForm').classList.remove('active');
    document.getElementById('productForm').reset();
    document.getElementById('imagePreview').innerHTML = '';
    editingId = null;
}

async function saveProduct() {
    const title = document.getElementById('titleInput').value.trim();
    const image = document.getElementById('imageInput').value.trim();
    const category = document.getElementById('categoryInput').value.trim();
    const price = document.getElementById('priceInput').value.trim();
    const description = document.getElementById('descriptionInput').value.trim();

    if (!title || !category || !price) {
        alert('Completa al menos: título, categoría y precio.');
        return;
    }

    const body = { title, image, category, price, description };

    try {
        const url = editingId
            ? `/api/products/${editingId}`
            : '/api/products';
        const method = editingId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (res.status === 401) {
            alert('Sesión expirada. Ingresa de nuevo.');
            location.reload();
            return;
        }

        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'Error al guardar');
            return;
        }

        hideForm();
        await renderTable();
    } catch (e) {
        alert('Error de conexión con el servidor');
    }
}

async function editProduct(id) {
    try {
        const res = await fetch(`/api/products/${id}`);
        if (!res.ok) return;
        const p = await res.json();
        showForm(p);
    } catch (e) {
        alert('Error al cargar el artículo');
    }
}

async function deleteProduct(id) {
    if (!confirm('¿Eliminar este artículo?')) return;
    try {
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        if (res.status === 401) {
            alert('Sesión expirada. Ingresa de nuevo.');
            location.reload();
            return;
        }
        if (!res.ok) {
            alert('Error al eliminar');
            return;
        }
        await renderTable();
    } catch (e) {
        alert('Error de conexión');
    }
}

async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
}

// ─── Image upload ───
async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        document.getElementById('imageInput').value = data.url;
        updatePreview(data.url);
    } catch (e) {
        alert('Error al subir la imagen');
    }
}

function updatePreview(url) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = `<img src="${escHtml(url)}" onerror="this.parentElement.innerHTML='<span style=color:var(--red)>URL inválida</span>'" style="max-width:120px;max-height:120px;object-fit:cover;border:1px solid var(--border);border-radius:4px">`;
}

document.getElementById('imageInput').addEventListener('input', function () {
    if (this.value) updatePreview(this.value);
});

// Add file upload support to the image input
const imageGroup = document.getElementById('imageInput').closest('.form-group');
const uploadBtn = document.createElement('input');
uploadBtn.type = 'file';
uploadBtn.accept = 'image/*';
uploadBtn.style.cssText = 'margin-top:8px;font-size:0.8rem';
uploadBtn.addEventListener('change', function () {
    if (this.files[0]) uploadImage(this.files[0]);
});
imageGroup.appendChild(uploadBtn);

// ─── Init ───
checkAuth();
