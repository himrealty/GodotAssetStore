// Store Configuration
const CONFIG = {
    PRODUCTS_JSON_PATH: 'data/products.json',
    GOOGLE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwHRcV2noGnfHiHSxpGvIjjlDWU8sDHV-ZlCPIZ5R8NYYRwZxiBQM67tqQxjkgRH-hQbg/exec' // Add your deployed Apps Script URL here
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
    const email = document.getElementById('customerEmail').value.trim().toLowerCase();
    const continueButton = document.querySelector('.modal-button-primary');
    
    // Validate email
    if (!email) {
        showModalError('Please enter your email address');
        return;
    }
    
    if (!isValidEmail(email)) {
        showModalError('Please enter a valid email address');
        return;
    }
    
    if (!selectedProduct) {
        showModalError('Product not selected');
        return;
    }
    
    // Check if Apps Script URL is configured
    if (CONFIG.GOOGLE_APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
        alert('⚠️ Apps Script not configured yet!\n\nPlease follow the setup guide to:\n1. Deploy Google Apps Script\n2. Add the URL to store.js\n\nSee SETUP-GUIDE.md for instructions.');
        return;
    }
    
    // Show loading state
    continueButton.disabled = true;
    continueButton.textContent = 'Checking...';
    
    try {
        // Step 1: Check if user already purchased this product
        const checkResponse = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'checkPurchase',
                email: email,
                productId: selectedProduct.id
            })
        });
        
        const checkData = await checkResponse.json();
        
        if (!checkData.success) {
            throw new Error(checkData.message || 'Failed to check purchase status');
        }
        
        // Check if already purchased
        if (checkData.purchased) {
            closeEmailModal();
            continueButton.disabled = false;
            continueButton.textContent = 'Continue to Payment';
            showAlreadyPurchasedModal(selectedProduct, email, checkData);
            return;
        }
        
        // Step 2: Not purchased, create Razorpay order
        continueButton.textContent = 'Creating order...';
        
        const orderResponse = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'createOrder',
                productId: selectedProduct.id,
                amount: selectedProduct.price,
                email: email
            })
        });
        
        const orderData = await orderResponse.json();
        
        if (!orderData.success) {
            throw new Error(orderData.message || 'Failed to create order');
        }
        
        // Step 3: Open Razorpay checkout
        closeEmailModal();
        continueButton.disabled = false;
        continueButton.textContent = 'Continue to Payment';
        
        openRazorpayCheckout(orderData, selectedProduct, email);
        
    } catch (error) {
        console.error('Error:', error);
        showModalError('Error: ' + error.message);
        continueButton.disabled = false;
        continueButton.textContent = 'Continue to Payment';
    }
}

// Open Razorpay Checkout
function openRazorpayCheckout(orderData, product, email) {
    const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Godot Game Assets',
        description: product.name,
        image: 'images/logo.png', // Your logo
        order_id: orderData.orderId,
        prefill: {
            email: email,
            name: '',
            contact: ''
        },
        theme: {
            color: '#ff6b35'
        },
        handler: function(response) {
            // Payment successful
            verifyAndDeliverProduct(response, product.id, email);
        },
        modal: {
            ondismiss: function() {
                console.log('Checkout closed');
            }
        }
    };
    
    const razorpay = new Razorpay(options);
    razorpay.open();
}

// Verify payment and deliver product
async function verifyAndDeliverProduct(paymentResponse, productId, email) {
    try {
        // Show processing modal
        showProcessingModal();
        
        const verifyResponse = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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
        console.error('Verification error:', error);
        closeProcessingModal();
        showErrorModal('Payment verification failed. Please contact support with your payment ID.');
    }
}

// Show already purchased modal
function showAlreadyPurchasedModal(product, email, checkData) {
    const modal = `
        <div class="modal-overlay active" id="alreadyPurchasedModal">
            <div class="email-modal">
                <button class="modal-close" onclick="closeAlreadyPurchasedModal()">✕</button>
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div style="font-size: 4rem;">✅</div>
                </div>
                <h2 class="modal-title">You Already Own This!</h2>
                
                <div class="modal-product-info">
                    <div style="margin-bottom: 0.5rem;">
                        <strong>Product:</strong> ${product.name}
                    </div>
                    <div style="margin-bottom: 0.5rem;">
                        <strong>Purchased:</strong> ${new Date(checkData.lastPurchaseDate).toLocaleDateString()}
                    </div>
                    <div>
                        <strong>Email:</strong> ${email}
                    </div>
                </div>
                
                <div style="background: rgba(0, 217, 255, 0.1); padding: 1rem; border-radius: 8px; border: 1px solid var(--accent); margin: 1.5rem 0;">
                    <p style="margin: 0; font-size: 0.9rem; color: var(--accent);">
                        📧 Check your email for the download link
                    </p>
                </div>
                
                <button class="modal-button modal-button-primary" onclick="resendDownloadLink('${email}', ${product.id})" style="width: 100%; margin-bottom: 0.5rem;">
                    📧 Resend Download Link
                </button>
                
                <button class="modal-button modal-button-secondary" onclick="closeAlreadyPurchasedModal()" style="width: 100%;">
                    Close
                </button>
                
                <p class="modal-note">
                    Can't find the email? Check your spam folder or contact support.
                </p>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
    document.body.style.overflow = 'hidden';
}

function closeAlreadyPurchasedModal() {
    const modal = document.getElementById('alreadyPurchasedModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
    }
}

// Resend download link
async function resendDownloadLink(email, productId) {
    const button = event.target;
    button.disabled = true;
    button.textContent = 'Sending...';
    
    try {
        const response = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'resendEmail',
                email: email,
                productId: productId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            button.textContent = '✓ Email Sent!';
            button.style.background = 'var(--success)';
            setTimeout(() => {
                closeAlreadyPurchasedModal();
            }, 2000);
        } else {
            button.textContent = 'Failed - Try Again';
            button.disabled = false;
            alert('Failed to resend email: ' + data.message);
        }
        
    } catch (error) {
        console.error('Resend error:', error);
        button.textContent = 'Error - Try Again';
        button.disabled = false;
        alert('Error resending email. Please contact support.');
    }
}

// Show processing modal
function showProcessingModal() {
    const modal = `
        <div class="modal-overlay active" id="processingModal">
            <div class="email-modal" style="text-align: center;">
                <div class="loading-spinner" style="margin: 2rem auto;"></div>
                <h2 class="modal-title">Processing Payment...</h2>
                <p>Please wait while we verify your payment and prepare your download.</p>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modal);
    document.body.style.overflow = 'hidden';
}

function closeProcessingModal() {
    const modal = document.getElementById('processingModal');
    if (modal) modal.remove();
}

// Show success modal
function showSuccessModal(email) {
    const modal = `
        <div class="modal-overlay active" id="successModal">
            <div class="email-modal">
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div style="font-size: 4rem;">🎉</div>
                </div>
                <h2 class="modal-title">Payment Successful!</h2>
                
                <div style="background: rgba(40, 167, 69, 0.1); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--success); margin: 1.5rem 0;">
                    <p style="margin: 0; font-size: 1.1rem; color: var(--success);">
                        ✓ Your purchase is complete!
                    </p>
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; color: #ccc;">
                        We've sent the download link to:<br>
                        <strong>${email}</strong>
                    </p>
                </div>
                
                <button class="modal-button modal-button-primary" onclick="closeSuccessModal()" style="width: 100%;">
                    Awesome!
                </button>
                
                <p class="modal-note">
                    Check your email (and spam folder) for the download link.
                </p>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
    document.body.style.overflow = 'hidden';
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
    }
}

// Show error modal
function showErrorModal(message) {
    const modal = `
        <div class="modal-overlay active" id="errorModal">
            <div class="email-modal">
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div style="font-size: 4rem;">⚠️</div>
                </div>
                <h2 class="modal-title">Payment Error</h2>
                
                <div style="background: rgba(220, 53, 69, 0.1); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--error); margin: 1.5rem 0;">
                    <p style="margin: 0; color: var(--error);">
                        ${message || 'Something went wrong with your payment.'}
                    </p>
                </div>
                
                <button class="modal-button modal-button-primary" onclick="closeErrorModal()" style="width: 100%;">
                    Close
                </button>
                
                <p class="modal-note">
                    If you were charged, please contact support with your payment details.
                </p>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
    document.body.style.overflow = 'hidden';
}

function closeErrorModal() {
    const modal = document.getElementById('errorModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
    }
}

// Show error in modal
function showModalError(message) {
    const emailInput = document.getElementById('customerEmail');
    emailInput.style.borderColor = 'var(--error)';
    
    // Create or update error message
    let errorDiv = document.querySelector('.modal-error');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'modal-error';
        emailInput.parentElement.insertBefore(errorDiv, emailInput.nextSibling);
    }
    
    errorDiv.textContent = message;
    errorDiv.style.color = 'var(--error)';
    errorDiv.style.fontSize = '0.85rem';
    errorDiv.style.marginTop = '0.5rem';
    
    // Reset border color after typing
    emailInput.addEventListener('input', function() {
        emailInput.style.borderColor = '';
        if (errorDiv) errorDiv.remove();
    }, { once: true });
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
