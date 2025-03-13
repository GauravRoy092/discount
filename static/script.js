document.addEventListener('DOMContentLoaded', function() {
    // Initialize the application
    checkStatus();
    loadCouponList();
    
    // Set up event handlers
    document.getElementById('claim-btn').addEventListener('click', claimCoupon);
    document.getElementById('reset-demo').addEventListener('click', resetDemo);
    
    // Add animation to the claim button
    const claimBtn = document.getElementById('claim-btn');
    claimBtn.addEventListener('mouseover', function() {
        this.innerHTML = '<i class="fas fa-gift"></i> Get Your Discount!';
    });
    claimBtn.addEventListener('mouseout', function() {
        this.innerHTML = '<i class="fas fa-gift"></i> Claim Your Coupon';
    });
});

// Check user's claim status
function checkStatus() {
    fetch('/api/check-status')
        .then(response => response.json())
        .then(data => {
            updateStats(data.stats);
            
            if (!data.canClaim) {
                document.getElementById('claim-btn').disabled = true;
                document.getElementById('timer-section').style.display = 'block';
                startCountdown(Math.floor(data.timeRemaining));
            }
        })
        .catch(error => {
            showMessage('Error connecting to server. Please try again.', 'error');
            console.error('Status check failed:', error);
        });
}

// Load the list of available coupons with animation and make them selectable
function loadCouponList() {
    fetch('/api/coupon-list')
        .then(response => response.json())
        .then(coupons => {
            const couponListEl = document.getElementById('coupon-list');
            couponListEl.innerHTML = '';
            
            if (coupons.length === 0) {
                couponListEl.innerHTML = '<p>No coupons available.</p>';
                return;
            }
            
            const list = document.createElement('ul');
            const couponItems = [];
            coupons.forEach((coupon, index) => {
                const item = document.createElement('li');
                item.textContent = coupon;
                item.style.animationDelay = `${index * 0.05}s`;
                item.style.animation = 'fadeIn 0.5s ease forwards';
                item.style.cursor = 'pointer';
                item.addEventListener('click', function() {
                    // Deselect previously selected items
                    couponItems.forEach(el => el.classList.remove('selected'));
                    // Mark clicked coupon as selected
                    item.classList.add('selected');
                    // Save selected coupon in a global variable
                    window.selectedCoupon = coupon;
                    // Update the selected coupon display (located above the coupons list in admin section)
                    const selectedDisplay = document.getElementById('selected-coupon-display');
                    selectedDisplay.textContent = `Selected Coupon: ${coupon}`;
                });
                couponItems.push(item);
                list.appendChild(item);
            });
            
            couponListEl.appendChild(list);
        })
        .catch(error => {
            console.error('Failed to load coupon list:', error);
        });
}

// Claim a coupon with visual feedback and optional coupon selection
function claimCoupon() {
    document.getElementById('claim-btn').disabled = true;
    document.getElementById('claim-btn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    // Check if a coupon was manually selected by the user
    let selectedCoupon = window.selectedCoupon;
    let postData = {};
    if (selectedCoupon) {
        postData.couponCode = selectedCoupon;
    }
    
    fetch('/api/claim-coupon', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('claim-btn').innerHTML = '<i class="fas fa-gift"></i> Claim Your Coupon';
        
        if (data.success) {
            showMessage(data.message, 'success');
            
            // Display claimed coupon with animation
            document.getElementById('coupon-code').textContent = data.couponCode;
            const couponDisplay = document.getElementById('coupon-display');
            couponDisplay.style.display = 'block';
            couponDisplay.style.opacity = '0';
            couponDisplay.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                couponDisplay.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                couponDisplay.style.opacity = '1';
                couponDisplay.style.transform = 'translateY(0)';
            }, 50);
            
            document.getElementById('timer-section').style.display = 'block';
            startCountdown(3600);
            createConfetti();
            
            // Reset selected coupon display and clear global selection
            window.selectedCoupon = null;
            const selectedDisplay = document.getElementById('selected-coupon-display');
            selectedDisplay.textContent = 'Select your coupon code';
        } else {
            showMessage(data.message, 'warning');
            if (data.timeRemaining) {
                document.getElementById('timer-section').style.display = 'block';
                startCountdown(Math.floor(data.timeRemaining));
            } else {
                document.getElementById('claim-btn').disabled = false;
            }
        }
        
        // Refresh status and coupon list
        checkStatus();
        loadCouponList();
    })
    .catch(error => {
        document.getElementById('claim-btn').innerHTML = '<i class="fas fa-gift"></i> Claim Your Coupon';
        showMessage('Error connecting to server. Please try again.', 'error');
        console.error('Claim failed:', error);
        document.getElementById('claim-btn').disabled = false;
    });
}

// Reset the demo with confirmation
function resetDemo() {
    if (confirm('Are you sure you want to reset the demonstration? All data will be cleared.')) {
        fetch('/api/reset-demo', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            showMessage(data.message, 'success');
            document.getElementById('coupon-display').style.display = 'none';
            document.getElementById('timer-section').style.display = 'none';
            document.getElementById('claim-btn').disabled = false;
            
            // Reset selected coupon display
            const selectedDisplay = document.getElementById('selected-coupon-display');
            selectedDisplay.textContent = 'Select your coupon code';
            
            // Refresh status and coupon list
            checkStatus();
            loadCouponList();
        })
        .catch(error => {
            showMessage('Error resetting demo. Please try again.', 'error');
            console.error('Reset failed:', error);
        });
    }
}

// Update statistics display with animation
function updateStats(stats) {
    if (stats) {
        animateCounter('claimed-count', stats.totalClaimed);
        animateCounter('unique-users', stats.uniqueUsers);
        animateCounter('remaining-count', stats.remainingCoupons);
    }
}

// Animate counter from current to target value
function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const currentValue = parseInt(element.textContent) || 0;
    const diff = targetValue - currentValue;
    
    if (diff === 0) return;
    
    let step = Math.abs(diff) > 100 ? 5 : 1;
    step = diff < 0 ? -step : step;
    
    let current = currentValue;
    const interval = setInterval(() => {
        current += step;
        
        if ((step > 0 && current >= targetValue) || 
            (step < 0 && current <= targetValue)) {
            clearInterval(interval);
            element.textContent = targetValue;
        } else {
            element.textContent = current;
        }
    }, 20);
}

// Show message to user with improved styling
function showMessage(text, type) {
    const messageContainer = document.getElementById('message-container');
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    
    let icon = '';
    switch(type) {
        case 'success':
            icon = '<i class="fas fa-check-circle"></i> ';
            break;
        case 'warning':
            icon = '<i class="fas fa-exclamation-triangle"></i> ';
            break;
        case 'error':
            icon = '<i class="fas fa-times-circle"></i> ';
            break;
    }
    
    messageEl.innerHTML = icon + text;
    
    messageContainer.innerHTML = '';
    messageContainer.appendChild(messageEl);
    
    setTimeout(() => {
        messageEl.style.opacity = '0';
        messageEl.style.transform = 'translateY(-10px)';
        messageEl.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        
        setTimeout(() => {
            messageEl.remove();
        }, 500);
    }, 5000);
}

// Start countdown timer with visual feedback
function startCountdown(seconds) {
    const countdownEl = document.getElementById('countdown');
    
    function updateCountdown() {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        countdownEl.textContent = `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
        
        if (seconds <= 60) {
            countdownEl.style.color = '#ff0000';
            countdownEl.style.animation = 'pulse 1s infinite';
        } else {
            countdownEl.style.color = '#ff6b6b';
            countdownEl.style.animation = 'none';
        }
        
        if (seconds === 0) {
            clearInterval(countdownInterval);
            
            const timerSection = document.getElementById('timer-section');
            timerSection.style.opacity = '0';
            timerSection.style.transform = 'translateY(-10px)';
            timerSection.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            
            setTimeout(() => {
                timerSection.style.display = 'none';
                timerSection.style.opacity = '1';
                timerSection.style.transform = 'translateY(0)';
            }, 500);
            
            document.getElementById('claim-btn').disabled = false;
            showMessage('You can now claim another coupon!', 'success');
        } else {
            seconds--;
        }
    }
    
    updateCountdown();
    
    const countdownInterval = setInterval(updateCountdown, 1000);
}

// Simple confetti effect for successful coupon claim
function createConfetti() {
    const container = document.querySelector('.container');
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.width = '10px';
        confetti.style.height = '10px';
        confetti.style.background = getRandomColor();
        confetti.style.position = 'absolute';
        confetti.style.top = '-10px';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        confetti.style.opacity = Math.random() + 0.5;
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        confetti.style.zIndex = '1000';
        
        container.appendChild(confetti);
        
        const animation = confetti.animate([
            { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
            { transform: `translate(${Math.random() * 100 - 50}px, ${Math.random() * 500 + 200}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
        ], {
            duration: Math.random() * 1500 + 1000,
            easing: 'cubic-bezier(0.645, 0.045, 0.355, 1)'
        });
        
        animation.onfinish = () => confetti.remove();
    }
}

// Get random color for confetti
function getRandomColor() {
    const colors = ['#4facfe', '#00f2fe', '#ff6b6b', '#feca57', '#1dd1a1', '#5f27cd'];
    return colors[Math.floor(Math.random() * colors.length)];
}
