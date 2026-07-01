const CART_KEY = 'kathkona-cart';
const ALLOWED_QUANTITIES = [5, 10, 15];
const menuBtn = document.querySelector('.menu-btn');
const menu = document.querySelector('.menu');
const menuIcon = document.querySelector('.menu-icon');

// Firebase config: replace the placeholders below with your actual project values.
// Find them in the Firebase console under Project Settings > General.
// Example:
// apiKey: 'AIzaSy...'
// authDomain: 'your-project.firebaseapp.com'
// projectId: 'your-project-id'
// storageBucket: 'your-project-id.appspot.com'
// messagingSenderId: '1234567890'
// appId: '1:1234567890:web:abcdef123456'
const FIREBASE_CONFIG = {
    apiKey: 'REPLACE_WITH_API_KEY',
    authDomain: 'REPLACE_WITH_AUTH_DOMAIN',
    projectId: 'REPLACE_WITH_PROJECT_ID',
    storageBucket: 'REPLACE_WITH_STORAGE_BUCKET',
    messagingSenderId: 'REPLACE_WITH_MESSAGING_SENDER_ID',
    appId: 'REPLACE_WITH_APP_ID'
};

let auth = null;
let recaptchaVerifier = null;
let firebaseConfigured = false;
let currentUser = null;
let afterLoginCallback = null;

function isFirebaseConfigValid() {
    return Object.values(FIREBASE_CONFIG).every((value) => {
        if (!value || typeof value !== 'string') return false;
        const lower = value.toLowerCase();
        const invalidPatterns = [
            'replace_with',
            'your_',
            'your-project',
            'project-id',
            'your-project-id',
            '1234567890',
            'abcdef',
            'sample'
        ];
        return !invalidPatterns.some((pattern) => lower.includes(pattern));
    });
}

function isSecureOrigin() {
    return window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
}

function initializeFirebase() {
    firebaseConfigured = isFirebaseConfigValid();
    if (!firebaseConfigured) {
        console.warn('Firebase config is not set. Please add your Firebase project values in main.js.');
        return;
    }

    if (window.location.protocol === 'file:') {
        console.warn('Firebase Auth cannot run from file:// URLs. Serve the site via localhost or HTTPS.');
    }

    if (window.firebase && !auth) {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            auth = firebase.auth();
            auth.onAuthStateChanged((user) => {
                updateUserStatus(user);
            });
        } catch (error) {
            console.warn('Firebase initialization failed:', error);
            auth = null;
        }
    }
}

initializeFirebase();

function saveCurrentUser(user) {
    localStorage.setItem('kathkona-user', JSON.stringify(user));
    if (user?.accountId) {
        localStorage.setItem(ACTIVE_ACCOUNT_KEY, user.accountId);
    }
}

function loadCurrentUser() {
    const raw = localStorage.getItem('kathkona-user');
    if (raw) {
        try {
            currentUser = JSON.parse(raw);
            updateUserStatus(currentUser);
        } catch (error) {
            currentUser = null;
        }
    }
}

function clearCurrentUser() {
    currentUser = null;
    localStorage.removeItem('kathkona-user');
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    updateUserStatus(null);
}

function simulateLogin(user) {
    setCurrentUser(user);
}

function getCart() {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function getCartCount(cart) {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function updateCartBadge() {
    const cart = getCart();
    document.querySelectorAll('.nav-cart span').forEach((badge) => {
        badge.textContent = getCartCount(cart);
    });
}

function setCurrentUser(user) {
    currentUser = user;
    saveCurrentUser(user);
    updateUserStatus(user);
}

function isLoggedIn() {
    return currentUser !== null;
}

const ADDRESS_STORAGE_KEY = 'kathkona-addresses';
const DEFAULT_ADDRESS_KEY = 'kathkona-address';
const ACCOUNTS_STORAGE_KEY = 'kathkona-accounts';
const ACTIVE_ACCOUNT_KEY = 'kathkona-active-account';

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function getCurrentAccountId() {
    if (currentUser?.accountId) return currentUser.accountId;
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY) || 'guest';
}

function getScopedStorageKey(baseKey) {
    return `${baseKey}:${getCurrentAccountId()}`;
}

function getStoredAccounts() {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function saveStoredAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

function findAccountByPhone(phoneNumber) {
    const accounts = getStoredAccounts();
    return accounts.filter((account) => account.phoneNumber === phoneNumber).sort((a, b) => b.createdAt - a.createdAt)[0] || null;
}

function createAccountForPhone(phoneNumber, displayName = 'Customer') {
    const accounts = getStoredAccounts();
    const newAccount = {
        id: `acct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        phoneNumber,
        displayName,
        createdAt: Date.now()
    };
    accounts.push(newAccount);
    saveStoredAccounts(accounts);
    return newAccount;
}

function getSavedAddresses() {
    const raw = localStorage.getItem(getScopedStorageKey(ADDRESS_STORAGE_KEY));
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function saveAddresses(addresses) {
    localStorage.setItem(getScopedStorageKey(ADDRESS_STORAGE_KEY), JSON.stringify(addresses));
}

function getSavedAddress() {
    const addresses = getSavedAddresses();
    const selectedId = localStorage.getItem(getScopedStorageKey(DEFAULT_ADDRESS_KEY));
    if (selectedId) {
        const selected = addresses.find((address) => address.id === selectedId);
        if (selected) return selected;
    }
    return addresses[0] || null;
}

function saveAddress(address) {
    const addresses = getSavedAddresses();
    const addressWithId = {
        ...address,
        id: address.id || `addr-${Date.now()}`
    };
    const existingIndex = addresses.findIndex((item) => item.id === addressWithId.id);
    if (existingIndex >= 0) {
        addresses[existingIndex] = addressWithId;
    } else {
        addresses.unshift(addressWithId);
    }
    saveAddresses(addresses);
    localStorage.setItem(getScopedStorageKey(DEFAULT_ADDRESS_KEY), addressWithId.id);
    return addressWithId;
}

function deleteAddress(addressId) {
    const addresses = getSavedAddresses().filter((address) => address.id !== addressId);
    saveAddresses(addresses);
    const selectedId = localStorage.getItem(getScopedStorageKey(DEFAULT_ADDRESS_KEY));
    if (!addresses.length) {
        localStorage.removeItem(getScopedStorageKey(DEFAULT_ADDRESS_KEY));
        return null;
    }
    if (!selectedId || selectedId === addressId) {
        localStorage.setItem(getScopedStorageKey(DEFAULT_ADDRESS_KEY), addresses[0].id);
    }
    return getSavedAddress();
}

function updateUserStatus(user) {
    const userBadge = document.getElementById('login-status');
    const navUsername = document.getElementById('nav-username');
    const userPanel = document.getElementById('user-menu-panel');
    const userName = document.getElementById('user-menu-name');
    const userPhone = document.getElementById('user-menu-phone');
    const userAddress = document.getElementById('user-menu-address');
    const savedAddress = getSavedAddress();

    const profileName = savedAddress?.name || user?.displayName || user?.phoneNumber || user?.email || 'Customer';
    const profileSubtext = user?.email || user?.phoneNumber || '';

    if (userBadge) {
        userBadge.textContent = profileSubtext;
        userBadge.classList.toggle('active', !!profileSubtext);
    }

    if (navUsername) {
        navUsername.textContent = user ? profileName : 'Guest';
    }
    if (userName) {
        userName.textContent = user ? profileName : 'Guest';
    }
    if (userPhone) {
        userPhone.textContent = user ? profileSubtext : 'Login to continue';
    }
    if (userAddress) {
        userAddress.textContent = savedAddress
            ? `${savedAddress.line}, ${savedAddress.city} - ${savedAddress.pin}`
            : 'No address saved yet.';
    }
    if (userPanel) {
        userPanel.setAttribute('aria-hidden', user ? 'false' : 'true');
        userPanel.classList.remove('active');
    }
}

function parsePrice(text) {
    return Number(text.replace(/[^0-9.]/g, '')) || 0;
}

function findProductFromElement(element) {
    const card = element.closest('.new-product-box') || element.closest('.swiper-slide');
    const titleEl = card?.querySelector('.new-product-title');
    const priceEl = card?.querySelector('.new-product-text span');
    const imageEl = card?.querySelector('img');
    const badgeEl = card?.querySelector('.new-product-img span');
    const title = titleEl?.textContent.trim() || 'Product';
    const price = parsePrice(priceEl?.textContent || '0');
    const category = card?.dataset.category?.trim() || badgeEl?.textContent.trim() || 'Handmade';
    const img = imageEl?.src || '';
    const idSource = `${title}-${img}`;
    const id = idSource.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    return { id, title, price, img, category };
}

function findProductFromButton(button) {
    return findProductFromElement(button);
}

function getMultiplier(quantity) {
    if (quantity === 15) return 80;
    if (quantity === 10) return 85;
    if (quantity === 5) return 90;
    return 1;
}

function getDiscountedUnitPrice(price, quantity) {
    return price * getMultiplier(quantity);
}

function getMultiplierLabel(quantity) {
    if (quantity === 15) return '×80 multiplier';
    if (quantity === 10) return '×85 multiplier';
    if (quantity === 5) return '×90 multiplier';
    return '';
}

function addToCart(product, quantity = 1, unitPrice = product.price) {
    // enforce allowed quantities
    if (!ALLOWED_QUANTITIES.includes(quantity)) {
        alert('Please select a quantity of 5, 10 or 15 only.');
        return;
    }
    const cart = getCart();
    const existing = cart.find((item) => item.id === product.id);
    const isTier = [5,10,15].includes(quantity) && unitPrice === getMultiplier(quantity);
    if (existing) {
        existing.quantity += quantity;
        existing.basePrice = product.price;
        existing.unitPrice = unitPrice;
        existing.category = product.category;
        existing.isTier = existing.isTier || isTier;
    } else {
        cart.push({ ...product, basePrice: product.price, unitPrice, quantity, isTier });
    }
    saveCart(cart);
    updateCartBadge();
}

function renderCartPage() {
    const cartItemsEl = document.getElementById('cart-items');
    const summaryCountEl = document.getElementById('summary-count');
    const summaryTotalEl = document.getElementById('summary-total');
    const cart = getCart();

    if (!cartItemsEl || !summaryCountEl || !summaryTotalEl) {
        return;
    }

    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<div class="empty-cart"><h3>Your cart is empty.</h3><p>Add items from the product section to see them here.</p></div>';
    } else {
        cartItemsEl.innerHTML = cart.map((item) => {
            const effectiveUnitPrice = item.unitPrice ?? item.basePrice ?? item.price;
            const isTierItem = item.isTier === true;
            const subtotal = (effectiveUnitPrice * item.quantity).toFixed(2);
            const tierExpression = null;
            return `
                <div class="cart-item" data-id="${item.id}">
                    <div class="cart-item-image">
                        <img src="${item.img}" alt="${item.title}" />
                    </div>
                    <div class="cart-item-details">
                        <div class="cart-item-header">
                            <div>
                                <h4>${item.title}</h4>
                                ${tierExpression ? `<p class="tier-expression">${tierExpression}</p>` : ''}
                                <p class="product-total">Total: ₹${subtotal}</p>
                                ${!isTierItem ? `<span class="unit-price">₹${effectiveUnitPrice.toFixed(2)} each</span>` : ''}
                            </div>
                        </div>
                        <div class="cart-item-footer">
                            <div class="quantity-controls">
                                <button class="qty-decrease" type="button">-</button>
                                <span class="quantity-value">${item.quantity}</span>
                                <button class="qty-increase" type="button">+</button>
                            </div>
                            <div class="cart-item-actions">
                                <button class="view-item-button" type="button">View Item</button>
                                <button class="remove-button" type="button">Remove</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    summaryCountEl.textContent = getCartCount(cart);
    const totalSum = cart.reduce((sum, item) => {
        const unit = item.unitPrice ?? item.basePrice ?? item.price;
        return sum + unit * item.quantity;
    }, 0);
    summaryTotalEl.textContent = '₹' + totalSum.toFixed(2);
}

function setupCartPageEvents() {
    const cartItemsEl = document.getElementById('cart-items');
    if (!cartItemsEl) return;

    cartItemsEl.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        const itemEl = button.closest('.cart-item');
        const itemId = itemEl?.dataset.id;
        if (!itemId) return;

        const cart = getCart();
        const item = cart.find((entry) => entry.id === itemId);
        if (!item) return;

        if (button.classList.contains('qty-increase')) {
            const attempted = item.quantity + 1;
            if (!ALLOWED_QUANTITIES.includes(attempted)) {
                alert('Only quantities of 5, 10 or 15 are allowed.');
                return;
            }
            item.quantity = attempted;
            saveCart(cart);
            renderCartPage();
        }

        if (button.classList.contains('qty-decrease')) {
            const attempted = Math.max(item.quantity - 1, 1);
            if (!ALLOWED_QUANTITIES.includes(attempted)) {
                alert('Only quantities of 5, 10 or 15 are allowed.');
                return;
            }
            item.quantity = attempted;
            saveCart(cart);
            renderCartPage();
        }

        if (button.classList.contains('view-item-button')) {
            const product = {
                id: item.id,
                title: item.title,
                price: item.price,
                img: item.img
            };
            if (window.openProductModal) {
                window.openProductModal(product, item.quantity);
            }
            return;
        }

        if (button.classList.contains('remove-button')) {
            const updated = cart.filter((entry) => entry.id !== itemId);
            saveCart(updated);
            renderCartPage();
        }

        updateCartBadge();
    });
}

function setupAddToCartButtons() {
    document.querySelectorAll('.new-product-cart-btn').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            const product = findProductFromElement(button);
            addToCart(product);
            button.textContent = 'Added';
            setTimeout(() => {
                button.innerHTML = '<i class="fa-solid fa-cart-shopping"></i> Add to Cart';
            }, 1000);
        });
    });
}

function setupProductModal() {
    const modal = document.getElementById('product-modal');
    const modalBackdrop = document.getElementById('product-backdrop');
    const modalClose = document.getElementById('product-modal-close');
    const modalImage = document.getElementById('product-modal-image');
    const modalTitle = document.getElementById('product-modal-title');
    const modalPrice = document.getElementById('product-modal-price');
    const modalTotal = document.getElementById('product-modal-total');
    const modalTier5 = document.getElementById('tier-button-5');
    const modalTier10 = document.getElementById('tier-button-10');
    const modalTier15 = document.getElementById('tier-button-15');
    const modalAddToCart = document.getElementById('product-modal-add-cart');
    const modalWhatsApp = document.getElementById('product-modal-whatsapp');
    let currentProduct = null;
    let currentQuantity = 1;
    let currentTier = null;

    if (!modal || !modalBackdrop || !modalClose || !modalImage || !modalTitle || !modalPrice || !modalTotal || !modalAddToCart || !modalWhatsApp) {
        return;
    }

    function formatPrice(value) {
        return Number(value).toFixed(2);
    }

    function updateModal() {
        if (!currentProduct) return;
        // quantity display removed from modal
        const isTier = [5, 10, 15].includes(currentQuantity) && currentTier;
            if (isTier) {
                const multiplier = getMultiplier(currentQuantity);
                const total = multiplier * currentQuantity;
                modalPrice.textContent = `₹${formatPrice(total)}`;
                modalTotal.textContent = '';
            } else {
            const discountedUnit = getDiscountedUnitPrice(currentProduct.price, currentQuantity);
            const total = discountedUnit * currentQuantity;
            modalPrice.textContent = `₹${formatPrice(total)}`;
            modalTotal.textContent = '';
        }
        modalWhatsApp.href = generateWhatsAppLink(currentProduct, currentQuantity);
        [modalTier5, modalTier10, modalTier15].forEach((btn) => {
            btn?.classList.toggle('active', btn === currentTier);
        });
    }

    function openModal(product, quantity = 1) {
        currentProduct = product;
        currentQuantity = quantity;
        // set currentTier if quantity matches a tier
        if (quantity === 5) currentTier = modalTier5;
        else if (quantity === 10) currentTier = modalTier10;
        else if (quantity === 15) currentTier = modalTier15;
        else currentTier = null;
        modalImage.src = product.img;
        modalImage.alt = product.title;
        modalTitle.textContent = product.title;
        modalPrice.textContent = `₹${formatPrice(product.price)}`;
        modalAddToCart.textContent = 'Add to Cart';
        modalAddToCart.dataset.action = 'add';
        updateModal();
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    }

    if (typeof window !== 'undefined') {
        window.openProductModal = openModal;
    }

    function setTier(tierButton, quantity) {
        currentTier = tierButton;
        currentQuantity = quantity;
        updateModal();
    }

    if (modalTier5) {
        modalTier5.addEventListener('click', () => setTier(modalTier5, 5));
    }
    if (modalTier10) {
        modalTier10.addEventListener('click', () => setTier(modalTier10, 10));
    }
    if (modalTier15) {
        modalTier15.addEventListener('click', () => setTier(modalTier15, 15));
    }

    function closeModal() {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }

    function generateWhatsAppLink(product, quantity) {
        let message = '';
        if ([5,10,15].includes(quantity)) {
            const multiplier = getMultiplier(quantity);
            const calc = `${quantity} x ${multiplier}`;
            const total = (multiplier * quantity).toFixed(2);
            message = `Hello,\n\nI would like to order the following product:\n\n📦 **Product:** ${product.title}\n🔢 **Set:** ${quantity}\n🧮 **Calculation:** ${calc} = ₹${total}\n\nPlease confirm the availability and let me know the next steps.\n\nThank you!`;
        } else {
            const discountedUnit = getDiscountedUnitPrice(product.price, quantity);
            const total = (discountedUnit * quantity).toFixed(2);
            message = `Hello,\n\nI would like to order the following product:\n\n📦 **Product:** ${product.title}\n🔢 **Quantity:** ${quantity}\n💰 **Price per piece:** ₹${formatPrice(discountedUnit)}\n💵 **Total:** ₹${total}\n\nPlease confirm the availability and let me know the next steps.\n\nThank you!`;
        }
        const phoneNumber = '9717009941';
        return `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
    }

    function addModalButtonsToCards() {
        document.querySelectorAll('.swiper-slide, .new-product-box').forEach((box) => {
            const imageLink = box.querySelector('.new-product-img');
            if (imageLink) {
                imageLink.addEventListener('click', (event) => {
                    const targetButton = event.target.closest('.new-product-cart-btn');
                    if (targetButton) return;
                    event.preventDefault();
                    const product = findProductFromElement(box);
                    openModal(product);
                });
            }
        });
    }

    // Quantity +/- controls removed from modal; tier buttons still set quantity.

    modalAddToCart.addEventListener('click', () => {
        if (!currentProduct) return;
        if (modalAddToCart.dataset.action === 'view') {
            window.location.href = 'cart.html';
            return;
        }
        // ensure only allowed quantities can be added
        if (!ALLOWED_QUANTITIES.includes(currentQuantity)) {
            alert('Please select a quantity of 5, 10 or 15 only before adding to cart.');
            return;
        }

        let unitPrice;
        if (ALLOWED_QUANTITIES.includes(currentQuantity) && currentTier) {
            // tier selected: use literal multiplier as unit price
            unitPrice = getMultiplier(currentQuantity);
        } else {
            unitPrice = getDiscountedUnitPrice(currentProduct.price, currentQuantity);
        }
        addToCart(currentProduct, currentQuantity, unitPrice);
        modalAddToCart.textContent = 'View Cart';
        modalAddToCart.dataset.action = 'view';
    });

    modalClose.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);

    addModalButtonsToCards();
}

function setupLoginModal() {
    const loginModal = document.getElementById('login-modal');
    const loginTrigger = document.getElementById('login-trigger');
    const loginClose = document.getElementById('login-close');
    const sendOtpBtn = document.getElementById('send-otp');
    const verifyOtpBtn = document.getElementById('verify-otp');
    const googleSignin = document.getElementById('google-signin');
    const otpStep = document.getElementById('otp-step');
    const loginMessage = document.getElementById('login-message');
    const loginPhone = document.getElementById('login-phone');
    const loginOtp = document.getElementById('login-otp');
    const recaptchaContainer = document.getElementById('recaptcha-container');
    const changeAddressBtn = document.getElementById('user-menu-change');
    const logoutButton = document.getElementById('user-menu-logout');
    const authSignupBtn = document.getElementById('auth-signup');
    const authLoginBtn = document.getElementById('auth-login');
    let confirmationResult = null;
    let authMode = 'signup';

    if (!loginModal || !loginTrigger || !loginClose || !sendOtpBtn || !verifyOtpBtn || !googleSignin || !otpStep || !loginMessage || !loginPhone || !loginOtp || !recaptchaContainer) {
        return;
    }

    function updateAuthModeUI() {
        if (authSignupBtn) authSignupBtn.classList.toggle('active', authMode === 'signup');
        if (authLoginBtn) authLoginBtn.classList.toggle('active', authMode === 'login');
        if (sendOtpBtn) sendOtpBtn.textContent = authMode === 'signup' ? 'Create Account' : 'Log In';
    }

    function openModal() {
        loginModal.classList.add('active');
        loginModal.setAttribute('aria-hidden', 'false');
        loginMessage.textContent = '';
        otpStep.classList.add('hidden');
        loginOtp.value = '';
        loginPhone.value = '';
        authMode = 'signup';
        updateAuthModeUI();
        if (firebaseConfigured && auth) {
            if (!recaptchaVerifier) {
                recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                    size: 'normal',
                    callback: () => {}
                });
                recaptchaVerifier.render().catch(() => {});
            }
        }
    }

    function closeModal() {
        loginModal.classList.remove('active');
        loginModal.setAttribute('aria-hidden', 'true');
    }

    function callAfterLogin() {
        if (typeof afterLoginCallback === 'function') {
            const callback = afterLoginCallback;
            afterLoginCallback = null;
            callback();
        }
    }

    function showMessage(text, success = true) {
        loginMessage.textContent = text;
        loginMessage.style.color = success ? 'var(--secondary-colour)' : '#c0392b';
    }

    loginTrigger.addEventListener('click', (event) => {
        event.preventDefault();
        const userPanel = document.getElementById('user-menu-panel');
        if (isLoggedIn()) {
            userPanel?.classList.toggle('active');
            return;
        }
        openModal();
    });

    if (changeAddressBtn) {
        changeAddressBtn.addEventListener('click', () => {
            const userPanel = document.getElementById('user-menu-panel');
            userPanel?.classList.remove('active');
            openAddressModal();
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            clearCurrentUser();
            const userPanel = document.getElementById('user-menu-panel');
            userPanel?.classList.remove('active');
        });
    }

    document.addEventListener('click', (event) => {
        const userPanel = document.getElementById('user-menu-panel');
        const trigger = document.getElementById('login-trigger');
        if (!userPanel || !trigger) return;
        const clickedInsidePanel = userPanel.contains(event.target);
        const clickedTrigger = trigger.contains(event.target);
        if (!clickedInsidePanel && !clickedTrigger) {
            userPanel.classList.remove('active');
        }
    });

    if (authSignupBtn) {
        authSignupBtn.addEventListener('click', () => {
            authMode = 'signup';
            updateAuthModeUI();
            showMessage('Create a fresh account with a new phone number.', true);
        });
    }
    if (authLoginBtn) {
        authLoginBtn.addEventListener('click', () => {
            authMode = 'login';
            updateAuthModeUI();
            showMessage('Log in with the phone number you already used.', true);
        });
    }

    loginClose.addEventListener('click', closeModal);
    loginModal.querySelector('.login-backdrop').addEventListener('click', closeModal);

    googleSignin.addEventListener('click', async () => {
        if (window.location.protocol === 'file:' && firebaseConfigured && auth) {
            showMessage('Firebase Auth requires localhost or HTTPS; file:// is not supported.', false);
            return;
        }
        if (!firebaseConfigured || !auth) {
            const savedAddress = getSavedAddress();
            const fallbackName = savedAddress?.name || loginPhone.value.trim() || 'Customer';
            showMessage(`Demo ${authMode === 'signup' ? 'sign-up' : 'log-in'} enabled. Signed in as ${fallbackName}.`, true);
            const user = { accountId: `acct-${Date.now()}`, displayName: fallbackName, email: 'demo@example.com' };
            setCurrentUser(user);
            setTimeout(() => {
                closeModal();
                callAfterLogin();
            }, 1200);
            return;
        }
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            const user = result.user;
            setCurrentUser(user);
            showMessage(`Signed in as ${user.displayName || user.email}`);
            setTimeout(() => {
                closeModal();
                callAfterLogin();
            }, 1200);
        } catch (error) {
            console.error('Google auth error', error);
            showMessage(`${error.code || 'ERROR'}: ${error.message}`, false);
        }
    });

    sendOtpBtn.addEventListener('click', async () => {
        const phone = loginPhone.value.trim();
        if (!/^[0-9]{10,15}$/.test(phone)) {
            showMessage('Please enter a valid phone number. Use digits only, including country code.', false);
            return;
        }
        if (window.location.protocol === 'file:' && firebaseConfigured && auth) {
            showMessage('Firebase Auth requires localhost or HTTPS; file:// is not supported.', false);
            return;
        }
        if (!firebaseConfigured || !auth) {
            confirmationResult = {
                phone: phone,
                confirm: async (code) => {
                    if (code === '123456') {
                        return { user: { phoneNumber: phone } };
                    }
                    throw new Error('Invalid OTP');
                }
            };
            otpStep.classList.remove('hidden');
            showMessage('Demo OTP sent. Use 123456 for this session.', true);
            return;
        }
        if (!recaptchaVerifier) {
            showMessage('Unable to initialize reCAPTCHA. Close and reopen the sign-in dialog.', false);
            return;
        }

        try {
            confirmationResult = await auth.signInWithPhoneNumber(phone, recaptchaVerifier);
            otpStep.classList.remove('hidden');
            showMessage(`OTP sent to ${phone}. Please enter the code.`);
        } catch (error) {
            console.error('Phone auth error', error);
            showMessage(`${error.code || 'ERROR'}: ${error.message}`, false);
            if (recaptchaVerifier && recaptchaVerifier.clear) {
                recaptchaVerifier.clear();
            }
            recaptchaVerifier = null;
        }
    });

    verifyOtpBtn.addEventListener('click', async () => {
        const otp = loginOtp.value.trim();
        if (!confirmationResult) {
            showMessage('Please request the OTP first.', false);
            return;
        }
        if (!otp || otp.length < 6) {
            showMessage('Enter a valid 6-digit OTP.', false);
            return;
        }
        try {
            const result = await confirmationResult.confirm(otp);
            const user = result.user;
            const phoneNumber = confirmationResult.phone || loginPhone.value.trim();
            const profile = authMode === 'signup'
                ? createAccountForPhone(phoneNumber, phoneNumber)
                : findAccountByPhone(phoneNumber);
            if (!profile) {
                showMessage('No account found for this phone number. Please use Sign Up first.', false);
                return;
            }
            const accountUser = {
                ...user,
                accountId: profile.id,
                displayName: profile.displayName || profile.phoneNumber || user.displayName || phoneNumber,
                phoneNumber: profile.phoneNumber || phoneNumber,
                email: user.email || `${phoneNumber}@demo.local`
            };
            setCurrentUser(accountUser);
            if (authMode === 'signup') {
                saveAddresses([]);
                localStorage.removeItem(getScopedStorageKey(DEFAULT_ADDRESS_KEY));
            }
            showMessage(authMode === 'signup' ? 'Account created successfully!' : 'Logged in successfully!');
            setTimeout(() => {
                closeModal();
                callAfterLogin();
            }, 1200);
        } catch (error) {
            showMessage(error.message || 'OTP verification failed.', false);
        }
    });
}

function populateAddressForm(address) {
    const addressName = document.getElementById('address-name');
    const addressPhone = document.getElementById('address-phone');
    const addressLine = document.getElementById('address-line');
    const addressCity = document.getElementById('address-city');
    const addressPin = document.getElementById('address-pin');
    const addressId = document.getElementById('address-id');
    if (!addressName || !addressPhone || !addressLine || !addressCity || !addressPin || !addressId) return;
    addressName.value = address?.name || '';
    addressPhone.value = address?.phone || '';
    addressLine.value = address?.line || '';
    addressCity.value = address?.city || '';
    addressPin.value = address?.pin || '';
    addressId.value = address?.id || '';
}

function clearAddressForm() {
    populateAddressForm({});
    const addressId = document.getElementById('address-id');
    if (addressId) addressId.value = '';
}

function renderAddressList() {
    const addressList = document.getElementById('address-list');
    if (!addressList) return;
    const addresses = getSavedAddresses();
    const selectedAddress = getSavedAddress();
    if (!addresses.length) {
        addressList.innerHTML = '<p class="address-empty">No saved addresses yet.</p>';
        return;
    }
    addressList.innerHTML = addresses.map((address) => {
        const isActive = selectedAddress?.id === address.id;
        return `
            <button type="button" class="address-item ${isActive ? 'active' : ''}" data-address-id="${address.id}">
                <div class="address-item-main">
                    <strong>${escapeHtml(address.name || 'Address')}</strong>
                    <span>${escapeHtml(address.line || '')}, ${escapeHtml(address.city || '')} - ${escapeHtml(address.pin || '')}</span>
                </div>
                <small>${escapeHtml(address.phone || '')}</small>
                <span class="address-delete-link" data-address-delete-id="${address.id}">Delete</span>
            </button>
        `;
    }).join('');
}

function openAddressModal() {
    const addressModal = document.getElementById('address-modal');
    if (!addressModal) return;
    const saved = getSavedAddress();
    if (saved) {
        populateAddressForm(saved);
    } else {
        clearAddressForm();
    }
    renderAddressList();
    addressModal.classList.add('active');
    addressModal.setAttribute('aria-hidden', 'false');
}

function closeAddressModal() {
    const addressModal = document.getElementById('address-modal');
    if (!addressModal) return;
    addressModal.classList.remove('active');
    addressModal.setAttribute('aria-hidden', 'true');
}

function getAddressFormData() {
    return {
        id: document.getElementById('address-id')?.value.trim() || '',
        name: document.getElementById('address-name')?.value.trim(),
        phone: document.getElementById('address-phone')?.value.trim(),
        line: document.getElementById('address-line')?.value.trim(),
        city: document.getElementById('address-city')?.value.trim(),
        pin: document.getElementById('address-pin')?.value.trim()
    };
}

function validateAddress(address) {
    return address.name && address.phone && address.line && address.city && address.pin;
}

function renderCheckoutSummary() {
    const checkoutDetails = document.getElementById('checkout-details');
    const paymentOptions = document.getElementById('payment-options');
    const address = getSavedAddress();
    const addresses = getSavedAddresses();
    const cart = getCart();
    if (!checkoutDetails || !paymentOptions || !address) return;
    const total = cart.reduce((sum, item) => {
        const unit = item.unitPrice ?? item.basePrice ?? item.price;
        return sum + unit * item.quantity;
    }, 0).toFixed(2);
    const savedAddressItems = addresses.length ? addresses.map((addr) => {
        const active = addr.id === address.id ? 'active' : '';
        return `<li class="checkout-address-item ${active}">${escapeHtml(addr.name)} - ${escapeHtml(addr.line)}, ${escapeHtml(addr.city)} - ${escapeHtml(addr.pin)}</li>`;
    }).join('') : '<li class="checkout-address-item empty">No saved addresses available.</li>';
    checkoutDetails.innerHTML = `
        <h4>Order Summary</h4>
        <p><strong>Name:</strong> ${escapeHtml(address.name)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(address.phone)}</p>
        <p><strong>Address:</strong> ${escapeHtml(address.line)}, ${escapeHtml(address.city)} - ${escapeHtml(address.pin)}</p>
        <p><strong>Total to pay:</strong> ₹${total}</p>
        <div class="checkout-address-change">
            <button type="button" class="checkout-change-address" id="checkout-change-address">Change Address</button>
            <div class="checkout-address-list">
                <strong>Saved addresses</strong>
                <ul>${savedAddressItems}</ul>
            </div>
        </div>
    `;
    checkoutDetails.classList.remove('hidden');
    paymentOptions.classList.remove('hidden');
    const changeButton = document.getElementById('checkout-change-address');
    if (changeButton) {
        changeButton.addEventListener('click', () => {
            openAddressModal();
        });
    }
}

function generateOrderMessage(address, cart, paymentMethod) {
    const items = cart.map((item) => `${item.quantity} x ${item.title}`).join(', ');
    const total = cart.reduce((sum, item) => {
        const unit = item.unitPrice ?? item.basePrice ?? item.price;
        return sum + unit * item.quantity;
    }, 0).toFixed(2);
    return `Hello,%0A%0ANew order received.%0A%0AName: ${encodeURIComponent(address.name)}%0APhone: ${encodeURIComponent(address.phone)}%0AAddress: ${encodeURIComponent(address.line + ', ' + address.city + ' - ' + address.pin)}%0AItems: ${encodeURIComponent(items)}%0ATotal: ₹${total}%0APayment method: ${encodeURIComponent(paymentMethod === 'upi' ? 'UPI' : 'Cash on Delivery')}%0A%0APlease confirm the order.`;
}

function sendOrderConfirmationMessage(address, cart, paymentMethod) {
    const phoneNumber = '9717009941';
    const message = generateOrderMessage(address, cart, paymentMethod);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
    console.log(`Sending order notification to ${phoneNumber}`);
    // Open WhatsApp with the order message for the seller
    window.open(whatsappUrl, '_blank', 'width=600,height=400');
    // Clear the cart after successful order
    saveCart([]);
    updateCartBadge();
}

function handlePaymentSelection(method) {
    const paymentOptions = document.getElementById('payment-options');
    const checkoutDetails = document.getElementById('checkout-details');
    const confirmButton = document.getElementById('confirm-order-button');
    if (!paymentOptions || !checkoutDetails || !confirmButton) return;
    paymentOptions.classList.add('hidden');
    confirmButton.classList.remove('hidden');
    checkoutDetails.innerHTML += `
        <p style="margin-top:12px; font-weight:700; color:#2f8f4f;">Payment method selected: ${method === 'upi' ? 'UPI' : 'Cash on Delivery'}. Your order is ready for confirmation.</p>
    `;
    alert(`Payment option selected: ${method === 'upi' ? 'UPI' : 'Cash on Delivery'}.`);
    confirmButton.onclick = () => {
        const address = getSavedAddress();
        const cart = getCart();
        if (!address || cart.length === 0) return;
        sendOrderConfirmationMessage(address, cart, method);
        confirmButton.textContent = 'Order Confirmed';
        confirmButton.disabled = true;
        checkoutDetails.innerHTML += `<p style="margin-top:12px; font-weight:700; color:#2f8f4f;">Your order has been confirmed and a message is being sent.</p>`;
    };
}

function checkoutFlow() {
    const cart = getCart();
    if (cart.length === 0) {
        alert('Your cart is empty. Add items before checkout.');
        return;
    }
    if (!isLoggedIn()) {
        afterLoginCallback = openAddressModal;
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.classList.add('active');
            loginModal.setAttribute('aria-hidden', 'false');
        }
        return;
    }
    const address = getSavedAddress();
    if (!address) {
        openAddressModal();
        return;
    }
    renderCheckoutSummary();
}

function setupCheckoutFlow() {
    const checkoutButton = document.getElementById('checkout-button');
    const addressClose = document.getElementById('address-close');
    const addressSave = document.getElementById('address-save');
    const addressMessage = document.getElementById('address-message');
    const addressList = document.getElementById('address-list');
    const addAddressButton = document.getElementById('address-add-new');
    const paymentButtons = document.querySelectorAll('.payment-option');

    if (checkoutButton) {
        checkoutButton.addEventListener('click', checkoutFlow);
    }
    if (addressClose) {
        addressClose.addEventListener('click', closeAddressModal);
    }
    if (addressSave) {
        addressSave.addEventListener('click', () => {
            const address = getAddressFormData();
            if (!validateAddress(address)) {
                if (addressMessage) {
                    addressMessage.textContent = 'Please fill in all address fields.';
                }
                return;
            }
            saveAddress(address);
            updateUserStatus(currentUser);
            renderAddressList();
            if (addressMessage) {
                addressMessage.textContent = 'Address saved successfully.';
                addressMessage.style.color = 'var(--main-colour)';
            }
            const saved = getSavedAddress();
            if (saved) {
                populateAddressForm(saved);
            }
            renderCheckoutSummary();
        });
    }
    if (addressList) {
        addressList.addEventListener('click', (event) => {
            const deleteButton = event.target.closest('[data-address-delete-id]');
            if (deleteButton) {
                event.preventDefault();
                event.stopPropagation();
                deleteAddress(deleteButton.dataset.addressDeleteId);
                updateUserStatus(currentUser);
                renderAddressList();
                const fallback = getSavedAddress();
                if (fallback) {
                    populateAddressForm(fallback);
                } else {
                    clearAddressForm();
                }
                renderCheckoutSummary();
                return;
            }
            const item = event.target.closest('.address-item');
            if (!item) return;
            const selected = getSavedAddresses().find((address) => address.id === item.dataset.addressId);
            if (selected) {
                localStorage.setItem(DEFAULT_ADDRESS_KEY, selected.id);
                populateAddressForm(selected);
                renderAddressList();
                updateUserStatus(currentUser);
                renderCheckoutSummary();
            }
        });
    }
    if (addAddressButton) {
        addAddressButton.addEventListener('click', () => {
            clearAddressForm();
            const addressMessage = document.getElementById('address-message');
            if (addressMessage) {
                addressMessage.textContent = 'Add a new delivery address above.';
                addressMessage.style.color = '#8c6b26';
            }
        });
    }
    paymentButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const method = button.dataset.method;
            handlePaymentSelection(method);
        });
    });
}

function setupSmoothScroll() {
    if (!menuBtn || !menu || !menuIcon) return;

    menuBtn.addEventListener('change', () => {
        const isOpen = menuBtn.checked;
        menu.classList.toggle('open', isOpen);
        menuIcon.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    menu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', (event) => {
            const targetId = link.getAttribute('href');
            if (!targetId || !targetId.startsWith('#')) return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                event.preventDefault();
                const headerOffset = 210;
                const elementPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
                const offsetPosition = elementPosition - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }

            menuBtn.checked = false;
            menu.classList.remove('open');
            menuIcon.setAttribute('aria-expanded', 'false');
        });
    });
}

loadCurrentUser();
updateCartBadge();
setupAddToCartButtons();
setupProductModal();
renderCartPage();
setupCartPageEvents();
setupCheckoutFlow();
setupSmoothScroll();
setupLoginModal();
