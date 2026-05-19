const WHATSAPP_NUMBER = '+573174169411';

const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

document.getElementById('themeToggle').addEventListener('click', () => {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  if (isDark) {
    html.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }
});

window.addEventListener('load', () => {
  document.getElementById('loader').classList.add('hidden');
  loadProducts();
  loadGallery();
  loadReviews();
});

const toggle = document.getElementById('navToggle');
const links = document.getElementById('navLinks');
toggle.addEventListener('click', () => {
  toggle.classList.toggle('active');
  links.classList.toggle('open');
});
links.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    toggle.classList.remove('active');
    links.classList.remove('open');
  });
});

function getWhatsAppLink(product) {
  const imageText = product.images && JSON.parse(product.images).length > 0
    ? '\n📸 ' + window.location.origin + JSON.parse(product.images)[0]
    : '';
  const text = `Hola! Me interesa este artículo de Benedicto:\n\n*${product.title}*\nCategoría: ${product.category}\nPrecio: $${product.price} COP\n${product.description ? 'Descripción: ' + product.description : ''}${imageText}\n\n¿Podrías darme más información?`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function parseImages(product) {
  if (!product.images) return [];
  try {
    const parsed = JSON.parse(product.images);
    return Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
  } catch {
    return product.images ? [product.images] : [];
  }
}

async function loadProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  let products = [];
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error();
    products = await res.json();
  } catch {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--muted)">Error al cargar artículos.</div>';
    return;
  }

  if (!products.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--muted)">
        No hay artículos todavía. Vuelve pronto.
      </div>`;
    return;
  }

  grid.innerHTML = products.map((p, i) => {
    const delay = i % 4;
    const cls = delay === 0 ? 'reveal' : `reveal reveal-delay-${delay}`;
    const images = parseImages(p);
    const imgSrc = images.length > 0 ? images[0] : '';
    const imageHtml = imgSrc
      ? `<img class="product-image" src="${escHtml(imgSrc)}" alt="${escHtml(p.title)}" onerror="this.outerHTML='<div class=product-image>📷</div>'">`
      : `<div class="product-image">📷</div>`;
    const multiBadge = images.length > 1
      ? `<p class="product-images-count">${images.length} fotos</p>`
      : '';
    return `
      <div class="product-card ${cls}" data-id="${p.id}">
        ${imageHtml}
        <p class="product-category">${escHtml(p.category)}</p>
        <h3 class="product-name">${escHtml(p.title)}</h3>
        <p class="product-price">$${escHtml(p.price)} COP</p>
        ${multiBadge}
        ${p.description ? `<p style="font-size:0.8rem;color:var(--muted);margin-top:8px;font-weight:300">${escHtml(p.description)}</p>` : ''}
        <a href="${getWhatsAppLink(p)}" target="_blank" class="product-whatsapp" onclick="event.stopPropagation()">Contactar</a>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.product-card:not(.is-sample)').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });

  document.querySelectorAll('.reveal:not(.visible)').forEach(el => observer.observe(el));
}

async function loadGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  try {
    const res = await fetch('/api/gallery');
    if (!res.ok) throw new Error();
    const items = await res.json();

    if (!items.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--muted)">Próximamente más imágenes.</div>';
      return;
    }

    grid.innerHTML = items.map((item, i) => {
      const delay = i % 4;
      const cls = delay === 0 ? 'reveal' : `reveal reveal-delay-${Math.min(delay, 4)}`;
      return `<div class="gallery-item ${cls}"><img src="${escHtml(item.url)}" alt="Galería Benedicto" loading="lazy"></div>`;
    }).join('');

    document.querySelectorAll('.gallery-item.reveal:not(.visible)').forEach(el => observer.observe(el));
  } catch {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--muted)">Error al cargar la galería.</div>';
  }
}

async function loadReviews() {
  const grid = document.getElementById('reviewsGrid');
  if (!grid) return;

  try {
    const res = await fetch('/api/reviews');
    if (!res.ok) throw new Error();
    const items = await res.json();

    if (!items.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--muted)">Sé el primero en dejar una reseña.</div>';
      return;
    }

    grid.innerHTML = items.map((r, i) => {
      const delay = i % 4;
      const cls = delay === 0 ? 'reveal' : `reveal reveal-delay-${Math.min(delay, 4)}`;
      const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      const date = new Date(r.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
      return `
        <div class="review-card ${cls}">
          <div class="review-stars">${stars}</div>
          <p class="review-comment">${escHtml(r.comment)}</p>
          <p class="review-author">${escHtml(r.name)}</p>
          <p class="review-date">${date}</p>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.reveal:not(.visible)').forEach(el => observer.observe(el));
  } catch {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--muted)">Error al cargar reseñas.</div>';
  }
}

let currentModalProduct = null;
let currentModalIndex = 0;

async function openModal(productId) {
  try {
    const res = await fetch(`/api/products/${productId}`);
    if (!res.ok) return;
    const p = await res.json();
    currentModalProduct = p;
    currentModalIndex = 0;
    renderModal();
    document.getElementById('productModal').classList.add('active');
    document.body.style.overflow = 'hidden';
  } catch {}
}

function renderModal() {
  const p = currentModalProduct;
  if (!p) return;

  const images = parseImages(p);
  const mainImg = document.getElementById('carouselImage');
  const thumbs = document.getElementById('carouselThumbs');
  const prev = document.getElementById('carouselPrev');
  const next = document.getElementById('carouselNext');

  document.getElementById('modalCategory').textContent = p.category;
  document.getElementById('modalTitle').textContent = p.title;
  document.getElementById('modalPrice').textContent = `$${p.price} COP`;
  document.getElementById('modalDesc').textContent = p.description || '';

  const waLink = getWhatsAppLink(p);
  document.getElementById('modalWhatsApp').href = waLink;

  if (images.length > 0) {
    mainImg.src = images[0];
    mainImg.style.display = 'block';
    thumbs.innerHTML = images.map((url, i) =>
      `<img src="${escHtml(url)}" class="${i === 0 ? 'active' : ''}" data-index="${i}" loading="lazy">`
    ).join('');

    thumbs.querySelectorAll('img').forEach(thumb => {
      thumb.addEventListener('click', () => {
        currentModalIndex = Number(thumb.dataset.index);
        updateCarousel();
      });
    });

    prev.style.display = images.length > 1 ? 'flex' : 'none';
    next.style.display = images.length > 1 ? 'flex' : 'none';
  } else {
    mainImg.src = '';
    mainImg.style.display = 'none';
    thumbs.innerHTML = '';
    prev.style.display = 'none';
    next.style.display = 'none';
  }
}

function updateCarousel() {
  const p = currentModalProduct;
  if (!p) return;
  const images = parseImages(p);
  const mainImg = document.getElementById('carouselImage');

  mainImg.style.opacity = '0';
  setTimeout(() => {
    mainImg.src = images[currentModalIndex];
    mainImg.style.opacity = '1';
  }, 150);

  document.querySelectorAll('#carouselThumbs img').forEach((thumb, i) => {
    thumb.classList.toggle('active', i === currentModalIndex);
  });
}

document.getElementById('carouselPrev').addEventListener('click', () => {
  const images = parseImages(currentModalProduct);
  currentModalIndex = (currentModalIndex - 1 + images.length) % images.length;
  updateCarousel();
});

document.getElementById('carouselNext').addEventListener('click', () => {
  const images = parseImages(currentModalProduct);
  currentModalIndex = (currentModalIndex + 1) % images.length;
  updateCarousel();
});

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('productModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'ArrowLeft' && currentModalProduct) {
    const images = parseImages(currentModalProduct);
    currentModalIndex = (currentModalIndex - 1 + images.length) % images.length;
    updateCarousel();
  }
  if (e.key === 'ArrowRight' && currentModalProduct) {
    const images = parseImages(currentModalProduct);
    currentModalIndex = (currentModalIndex + 1) % images.length;
    updateCarousel();
  }
});

function closeModal() {
  document.getElementById('productModal').classList.remove('active');
  document.body.style.overflow = '';
  currentModalProduct = null;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

const divider = document.querySelector('.divider');
if (divider && !window.matchMedia('(max-width: 700px)').matches) {
  window.addEventListener('scroll', () => {
    const rect = divider.getBoundingClientRect();
    const speed = 0.35;
    divider.style.backgroundPositionY = `${rect.top * speed}px`;
  }, { passive: true });
}

document.querySelectorAll('.carousel-thumbs').forEach(el => {
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }, { passive: false });
});
