const CONFIG = {
    DATA: 'data/datadollar.json',
    URL: 'https://script.google.com/macros/s/AKfycbwcdjHW4yAoz5eCPKzgBVIw6_IzJhgvqDlwdXhL7EHezpFZEAsByzNKi69i3LUt2N65/exec' 
};

let products = [];
let activeItem = null;

async function init() {
    const res = await fetch(CONFIG.DATA);
    products = await res.json();
    document.getElementById('productGrid').innerHTML = products.map(p => `
        <div class="product-card">
            <img src="${p.image}" class="product-image">
            <div class="product-info">
                <h3>${p.name}</h3>
                <p>${p.description}</p>
                <div class="product-footer">
                    <span>$${p.price.toFixed(2)}</span>
                    <button class="buy-button" onclick="openModal('${p.id}')">Buy</button>
                </div>
            </div>
        </div>
    `).join('');
}

function openModal(id) {
    activeItem = products.find(p => p.id === id);
    document.getElementById('modalProductName').innerText = activeItem.name;
    document.getElementById('modalProductPrice').innerText = `$${activeItem.price}`;
    document.getElementById('emailModal').classList.add('active');
    renderPaypal();
}

function closeEmailModal() {
    document.getElementById('emailModal').classList.remove('active');
    document.getElementById('paypal-button-container').innerHTML = '';
}

function renderPaypal() {
    paypal.Buttons({
        createOrder: (data, actions) => {
            const email = document.getElementById('customerEmail').value;
            if (!email.includes('@')) return alert('Valid email required');
            return actions.order.create({
                purchase_units: [{ amount: { value: activeItem.price.toString() }, description: activeItem.name }]
            });
        },
        onApprove: async (data, actions) => {
            await actions.order.capture();
            verify(data.orderID);
        }
    }).render('#paypal-button-container');
}

async function verify(orderId) {
    const email = document.getElementById('customerEmail').value;
    const res = await fetch(CONFIG.URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'verifyPayPal', orderId, productId: activeItem.id, email, amount: activeItem.price })
    });
    const result = await res.json();
    if (result.success) {
        alert('Payment Success! Check email.');
        closeEmailModal();
    }
}

init();
