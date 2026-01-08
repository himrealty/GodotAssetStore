// Store Configuration
const CONFIG = {
    PRODUCTS_JSON_PATH: 'data/products.json',
    GOOGLE_APPS_SCRIPT_URL: 'YOUR_APPS_SCRIPT_URL_HERE' // We'll add this later
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
    
    // Apply category filter
    if (currentFilter !== 'all') {
        if (currentFilter === 'featured') {
            filtered = filtered.filter(p => p.featured);
        } else {
            filtered = filtered.filter(p => p.category === currentFilter);
        }
    }
    
    // Apply search filter
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

// Setup filter buttons
function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Update active state
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Update filter
            currentFilter = this.dataset.category;
            filterProducts();
        });
    });
}

// Setup search
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    
    searchInput.addEventListener('input', function() {
        currentSearch = this.value.trim();
        filterProducts();
    });
}

// Email Modal Functions
function openEmailModal(productId) {
    selectedProduct = allProducts.find(p => p.id === productId);
    
    if (!selectedProduct) {
        alert('Product not found');
        return;
    }
    
    // Update modal content
    document.getElementById('modalProductName').textContent = selectedProduct.name;
    document.getElementById('modalProductPrice').textContent = `₹${selectedProduct.price}`;
    document.getElementById('customerEmail').value = '';
    
    // Show modal
    document.getElementById('emailModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeEmailModal() {
    document.getElementById('emailModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    selectedProduct = null;
}

// Proceed to payment
async function proceedToPayment() {
    const email = document.getElementById('customerEmail').value.trim();
    
    // Validate email
    if (!email) {
        alert('Please enter your email address');
        return;
    }
    
    if (!isValidEmail(email)) {
        alert('Please enter a valid email address');
        return;
    }
    
    if (!selectedProduct) {
        alert('Product not selected');
        return;
    }
    
    // Close modal and show processing
    closeEmailModal();
    
    // Here we'll integrate with Google Apps Script
    // For now, just show alert
    alert(`Next Step: Integrate with Google Apps Script
    
Product: ${selectedProduct.name}
Price: ₹${selectedProduct.price}
Email: ${email}

We'll implement this in the next step!`);
    
    // TODO: Call Google Apps Script to:
    // 1. Check if user already purchased
    // 2. Create Razorpay order
    // 3. Open Razorpay checkout
}

// Email validation
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Loading states
function showLoading() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('productsGrid').style.display = 'none';
    document.getElementById('noProductsState').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loadingState').style.display = 'none';
}

function showError() {
    document.getElementById('loadingState').innerHTML = `
        <div class="no-products-icon">⚠️</div>
        <h3>Error Loading Products</h3>
        <p>Please try refreshing the page</p>
    `;
}

// Mobile Menu Functions
function initializeMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileCloseBtn = document.getElementById('mobileCloseBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', openMobileMenu);
    }
    
    if (mobileCloseBtn) {
        mobileCloseBtn.addEventListener('click', closeMobileMenu);
    }
    
    if (mobileMenuOverlay) {
        mobileMenuOverlay.addEventListener('click', closeMobileMenu);
    }

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMobileMenu();
            closeEmailModal();
        }
    });
}

function openMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    
    if (mobileMenu) mobileMenu.classList.add('active');
    if (mobileMenuOverlay) mobileMenuOverlay.classList.add('active');
    document.body.classList.add('menu-open');
}

function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    
    if (mobileMenu) mobileMenu.classList.remove('active');
    if (mobileMenuOverlay) mobileMenuOverlay.classList.remove('active');
    document.body.classList.remove('menu-open');
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        
        e.preventDefault();
        const targetElement = document.querySelector(href);
        
        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
            closeMobileMenu();
        }
    });
});
