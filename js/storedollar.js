const CONFIG = {
    // 1. FIXED: Pointing to the correct filename you uploaded
    DATA: 'data/dollar.json', 
    // 2. Your Google Apps Script Web App URL
    URL: 'https://script.google.com/macros/s/AKfycbwcdjHW4yAoz5eCPKzgBVIw6_IzJhgvqDlwdXhL7EHezpFZEAsByzNKi69i3LUt2N65/exec' 
};

let products = [];
let activeItem = null;

async function init() {
    try {
        console.log("Fetching from:", CONFIG.DATA);
        const res = await fetch(CONFIG.DATA);
        
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        products = await res.json();
        renderProducts(products);
    } catch (error) {
        console.error('Fetch Error:', error);
        document.getElementById('productGrid').innerHTML = `
            <div style="color: white; text-align: center; padding: 50px;">
                <h3>Error: Failed to load assets</h3>
                <p>${error.message}</p>
                <p>Ensure dollar.json is in the /data folder.</p>
            </div>`;
    }
}

function renderProducts(items) {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = items.map(p => `
        <div class="product-card">
            <div class="product-image">
                <img src="${p.image}" alt="${p.name}" onerror="this.src='https://placehold.co/600x400?text=Asset'">
            </div>
            <div class="product-info">
                <span class="category-badge">${p.category}</span>
                <h3>${p.name}</h3>
                <p>${p.description}</p>
                <div class="product-footer">
                    <span class="product-price">$${p.price.toFixed(2)}</span>
                    <button class="buy-button" onclick="openModal('${p.id}')">Buy Now</button>
                </div>
            </div>
        </div>
    `).join('');
}

// ... (keep openModal, closeEmailModal, and verify functions same as before)
init();
