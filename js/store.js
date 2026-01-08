// Store Configuration
const CONFIG = {
    PRODUCTS_JSON_PATH: 'data/products.json',
    // Updated with your latest deployment URL
    GOOGLE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwHRcV2noGnfHiHSxpGvIjjlDWU8sDHV-ZlCPIZ5R8NYYRwZxiBQM67tqQxjkgRH-hQbg/exec'
};

// Global variables
let allProducts = [];
let currentFilter = 'all';
let currentSearch = '';
let selectedProduct = null;

// Initialize store on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeMobileMenu();
    loadProducts();
    setupFilterButtons();
    setupSearch();
});

// Load products from JSON
async function loadProducts() {
    try {
        showLoading();
        const response = await fetch(CONFIG.PRODUCTS_JSON_PATH);
        if (!response.ok) throw new Error('Failed to load products');
        allProducts = await response.json();
        displayProducts(allProducts);
        hideLoading();
    } catch (error) {
        console.error('Error loading products:', error);
        showError();
    }
}

// Display products in grid
function displayProducts(products) {
    const grid = document.getElementById('productsGrid');
    const noProductsState = document.getElementById('noProductsState');
    
    if (products.length === 0) {
        grid.style.display = 'none';
        noProductsState.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    noProductsState.style.display = 'none';
    
    grid.innerHTML = products.map(product => `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-image">
                <img src="${product.image}" alt="${product.name}" onerror="this.style.display='none'; this.parentElement.innerHTML='🎮'">
                ${product.featured ? '<span class="featured-badge">Featured</span>' : ''}
            </div>
            <div class="product-content">
                <div class="product-category">${product.category}</div>
                <h3 class="product-title">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-footer">
                    <div class="product-price">
                        <span class="product-price-currency">₹</span>${product.price}
                    </div>
                    <button class="buy-button" onclick="openEmailModal(${product.id})">
                        Buy Now
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Filter and Search Logic
function filterProducts() {
    let filtered = allProducts;
    if (currentFilter !== 'all') {
        filtered = (currentFilter === 'featured') ? filtered.filter(p => p.featured) : filtered.filter(p => p.category === currentFilter);
    }
    if (currentSearch) {
        const search = currentSearch.toLowerCase();
        filtered = filtered.filter(p => p.name.toLowerCase().includes(search) || p.description.toLowerCase().includes(search));
    }
    displayProducts(filtered);
}

function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.category;
            filterProducts();
        });
    });
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            currentSearch = this.value.trim();
            filterProducts();
        });
    }
}

// Modal Functions
function openEmailModal(productId) {
    selectedProduct = allProducts.find(p => p.id === productId);
    if (!selectedProduct) return;
    document.getElementById('modalProductName').textContent = selectedProduct.name;
    document.getElementById('modalProductPrice').textContent = `₹${selectedProduct.price}`;
    document.getElementById('customerEmail').value = '';
    document.getElementById('emailModal').classList.add('active');
}

function closeEmailModal() {
    document.getElementById('emailModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    selectedProduct = null;
}

// --- CORE PAYMENT LOGIC ---
async function proceedToPayment() {
    const emailInput = document.getElementById('customerEmail');
    const email = emailInput.value.trim().toLowerCase();
    const continueButton = document.querySelector('.modal-button-primary');
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Please enter a valid email address');
        return;
    }

    continueButton.disabled = true;
    continueButton.textContent = 'Contacting Server...';
    
    try {
        // 1. Check if already purchased
        const checkResponse = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'checkPurchase',
                email: email,
                productId: selectedProduct.id
            })
        });
        
        const checkData = await checkResponse.json();
        if (checkData.purchased) {
            alert('You already own this product! We have re-sent the download link to your email.');
            closeEmailModal();
            return;
        }
        
        // 2. Create Order
        continueButton.textContent = 'Opening Razorpay...';
        const orderResponse = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'createOrder',
                productId: selectedProduct.id,
                amount: selectedProduct.price,
                email: email
            })
        });
        
        const orderData = await orderResponse.json();

        if (!orderData.success) {
            throw new Error(orderData.message || 'Order creation failed on server');
        }
        
        // Pass data to Razorpay Checkout
        startRazorpay(orderData, email);
        
    } catch (error) {
        console.error('Process Error:', error);
        alert('Connection Error: ' + error.message);
        continueButton.disabled = false;
        continueButton.textContent = 'Continue to Payment';
    }
}

function startRazorpay(orderData, email) {
    const options = {
        "key": orderData.key, // Your Apps Script returns "key"
        "amount": orderData.amount,
        "currency": "INR",
        "name": "Godot Game Assets",
        "description": selectedProduct.name,
        "order_id": orderData.orderId,
        "prefill": { "email": email },
        "theme": { "color": "#ff6b35" },
        "handler": function (response) {
            // This runs after successful payment
            closeEmailModal();
            verifyPayment(response, email);
        },
        "modal": {
            "ondismiss": function() {
                // Reset button if user closes the Razorpay window
                const btn = document.querySelector('.modal-button-primary');
                if(btn) {
                    btn.disabled = false;
                    btn.textContent = 'Continue to Payment';
                }
            }
        }
    };

    const rzp = new Razorpay(options);
    rzp.open();
}

async function verifyPayment(paymentResponse, email) {
    // Show a basic processing alert or overlay here if desired
    try {
        const verifyResponse = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'verifyPayment',
                orderId: paymentResponse.razorpay_order_id,
                paymentId: paymentResponse.razorpay_payment_id,
                signature: paymentResponse.razorpay_signature,
                productId: selectedProduct.id,
                email: email
            })
        });
        
        const result = await verifyResponse.json();
        if (result.success) {
            alert('Payment Successful! The download link has been sent to ' + email);
        } else {
            alert('Verification Error: ' + result.message);
        }
    } catch (error) {
        alert('Verification failed. Please contact support with your Payment ID.');
    }
}

// UI Helpers
function showLoading() { document.getElementById('loadingState').style.display = 'block'; }
function hideLoading() { document.getElementById('loadingState').style.display = 'none'; }
function showError() { document.getElementById('loadingState').innerHTML = '<h3>Error Loading Products</h3>'; }

function initializeMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const menu = document.getElementById('mobileMenu');
    const close = document.getElementById('mobileCloseBtn');
    if(btn) btn.onclick = () => menu.classList.add('active');
    if(close) close.onclick = () => menu.classList.remove('active');
}
