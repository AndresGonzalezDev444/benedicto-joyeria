// ─── Loader ───
window.addEventListener('load', () => {
    document.getElementById('loader').classList.add('hidden');
    loadProducts();
});

// ─── Mobile nav toggle ───
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

// ─── WhatsApp config ───
const WHATSAPP_NUMBER = '+573174169411';

function getWhatsAppLink(product) {
    const text = `Hola! Me interesa este artículo de Benedicto:\n\n*${product.title}*\nCategoría: ${product.category}\nPrecio: $${product.price}\n${product.description ? 'Descripción: ' + product.description : ''}\n\n¿Podrías darme más información?`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

// ─── Products from API ───
async function loadProducts() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    let products = [];
    try {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error('Error al cargar');
        products = await res.json();
    } catch (e) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--muted)">Error al cargar artículos. ¿El servidor está corriendo?</div>`;
        return;
    }

    if (!products.length) {
        grid.innerHTML = `
            <div class="product-card reveal is-sample" style="cursor:default;opacity:0.4">
                <div class="product-image">✨</div>
                <p class="product-category">Cadena</p>
                <h3 class="product-name">Link Clásico</h3>
                <p class="product-price">$189 USD</p>
            </div>
            <div class="product-card reveal reveal-delay-1 is-sample" style="cursor:default;opacity:0.4">
                <div class="product-image">⌚</div>
                <p class="product-category">Pulsera</p>
                <h3 class="product-name">Tejido Milano</h3>
                <p class="product-price">$145 USD</p>
            </div>
            <div class="product-card reveal reveal-delay-2 is-sample" style="cursor:default;opacity:0.4">
                <div class="product-image">💍</div>
                <p class="product-category">Anillo</p>
                <h3 class="product-name">Aro Continuo</h3>
                <p class="product-price">$95 USD</p>
            </div>
            <div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--muted);font-size:0.85rem">
                Usa el panel <a href="/admin.html" style="color:var(--gold)">Admin</a> para agregar artículos desde la BD.
            </div>`;
        return;
    }

    grid.innerHTML = products.map((p, i) => {
        const delay = i % 4;
        const cls = delay === 0 ? 'reveal' : `reveal reveal-delay-${delay}`;
        const imageHtml = p.image
            ? `<img class="product-image" src="${escHtml(p.image)}" alt="${escHtml(p.title)}" onerror="this.outerHTML='<div class=product-image>📷</div>'">`
            : `<div class="product-image">📷</div>`;
        return `
            <div class="product-card ${cls}" data-id="${p.id}">
                ${imageHtml}
                <p class="product-category">${escHtml(p.category)}</p>
                <h3 class="product-name">${escHtml(p.title)}</h3>
                <p class="product-price">$${escHtml(p.price)}</p>
                ${p.description ? `<p style="font-size:0.8rem;color:var(--muted);margin-top:8px;font-weight:300">${escHtml(p.description)}</p>` : ''}
                <a href="${getWhatsAppLink(p)}" target="_blank" class="product-whatsapp" onclick="event.stopPropagation()">
                    Contactar
                </a>
            </div>
        `;
    }).join('');

    // Re-bind tilt effect on new cards
    document.querySelectorAll('.product-card:not(.is-sample)').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            if (window.matchMedia('(max-width: 700px)').matches) return;
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;
            card.style.transform =
                `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });

    // Observe new reveal elements
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => observer.observe(el));
}

function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

// ─── Intersection Observer for reveals ───
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ─── Parallax divider ───
const divider = document.querySelector('.divider');
if (divider && !window.matchMedia('(max-width: 700px)').matches) {
    window.addEventListener('scroll', () => {
        const rect = divider.getBoundingClientRect();
        const speed = 0.35;
        const yPos = rect.top * speed;
        divider.style.backgroundPositionY = `${yPos}px`;
    }, { passive: true });
}
