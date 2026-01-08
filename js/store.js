// Store Configuration
const CONFIG = {
    PRODUCTS_JSON_PATH: 'data/products.json',
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
        
        if (!response.ok) {
            throw new Error('Failed to load products');
        }
        
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

// Filter products
function filterProducts() {
    let filtered = allProducts;
    
    if (currentFilter !== 'all') {
        if (currentFilter === 'featured') {
            filtered = filtered.filter(p => p.featured);
        } else {
            filtered = filtered.filter(p => p.category === currentFilter);
        }
    }
    
    if (currentSearch) {
        const search = currentSearch.toLowerCase();
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(search) ||
            p.description.toLowerCase().includes(search) ||
            p.category.toLowerCase().includes(search)
        );
    }
    
    displayProducts(filtered);
}

// Setup functions
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
    document.body.style.overflow = 'hidden';
}

function closeEmailModal() {
    document.getElementById('emailModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    selectedProduct = null;
}

// --- UPDATED PAYMENT LOGIC TO FIX "FAILED TO FETCH" ---
async function proceedToPayment() {
    const email = document.getElementById('customerEmail').value.trim().toLowerCase();
    const continueButton = document.querySelector('.modal-button-primary');
    
    if (!email || !isValidEmail(email)) {
        showModalError('Please enter a valid email address');
        return;
    }

    continueButton.disabled = true;
    continueButton.textContent = 'Checking...';
    
    try {
        // Step 1: Check Purchase Status
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
            closeEmailModal();
            showAlreadyPurchasedModal(selectedProduct, email, checkData);
            return;
        }
        
        // Step 2: Create Razorpay Order
        continueButton.textContent = 'Creating order...';
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
        console.log("Order Data Received:", orderData);

        if (!orderData.success) throw new Error(orderData.message);
        
        closeEmailModal();
        openRazorpayCheckout(orderData, selectedProduct, email);
        
    } catch (error) {
        console.error('Fetch Error:', error);
        showModalError('Connection Error: Please ensure Apps Script is deployed as "Anyone"');
    } finally {
        continueButton.disabled = false;
        continueButton.textContent = 'Continue to Payment';
    }
}

function openRazorpayCheckout(orderData, product, email) {
    const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Godot Game Assets',
        description: product.name,
        order_id: orderData.orderId,
        prefill: { email: email },
        theme: { color: '#ff6b35' },
        handler: function(response) {
            verifyAndDeliverProduct(response, product.id, email);
        }
    };
    const razorpay = new Razorpay(options);
    razorpay.open();
}

async function verifyAndDeliverProduct(paymentResponse, productId, email) {
    showProcessingModal();
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
                productId: productId,
                email: email
            })
        });
        
        const verifyData = await verifyResponse.json();
        closeProcessingModal();
        
        if (verifyData.success) {
            showSuccessModal(email);
        } else {
            showErrorModal(verifyData.message);
        }
    } catch (error) {
        closeProcessingModal();
        showErrorModal('Verification failed. Please contact support.');
    }
}

// Utility Functions (Keep your existing versions of these)
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showModalError(message) {
    const emailInput = document.getElementById('customerEmail');
    let errorDiv = document.querySelector('.modal-error');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'modal-error';
        emailInput.parentElement.insertBefore(errorDiv, emailInput.nextSibling);
    }
    errorDiv.textContent = message;
    errorDiv.style.color = '#ff4b2b';
    errorDiv.style.fontSize = '0.85rem';
}

function showLoading() { document.getElementById('loadingState').style.display = 'block'; }
function hideLoading() { document.getElementById('loadingState').style.display = 'none'; }
function showError() { document.getElementById('loadingState').innerHTML = '<h3>Error Loading Products</h3>'; }

// Mobile Menu
function initializeMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const close = document.getElementById('mobileCloseBtn');
    const menu = document.getElementById('mobileMenu');
    if(btn) btn.onclick = () => menu.classList.add('active');
    if(close) close.onclick = () => menu.classList.remove('active');
}
