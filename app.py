from flask import Flask, render_template, request, jsonify, make_response
import json
import os
import time
import uuid

app = Flask(__name__)

# Paths to data storage files
COUPONS_FILE = 'data/coupons.json'
CLAIMS_FILE = 'data/claims.json'
STATS_FILE = 'data/stats.json'

# Ensure data directory exists
os.makedirs('data', exist_ok=True)

# Initialize data files if they don't exist
def initialize_data_files():
    if not os.path.exists(COUPONS_FILE):
        coupons = [
            'SPRING25OFF', 'SUMMER20PCT', 'FALL15SAVE', 'WINTER30NOW',
            'FLASH50CODE', 'SPECIAL10UP', 'MEMBER25VIP', 'BONUS35PCT',
            'EXTRA15NOW', 'WEEKEND40', 'SEASON20OFF', 'HOLIDAY45',
            'SAVE25TODAY', 'DISCOUNT30', 'PROMO20PCT', 'DEAL15NOW'
        ]
        with open(COUPONS_FILE, 'w') as f:
            json.dump(coupons, f)
    
    if not os.path.exists(CLAIMS_FILE):
        with open(CLAIMS_FILE, 'w') as f:
            json.dump({}, f)
    
    if not os.path.exists(STATS_FILE):
        stats = {
            'total_claimed': 0,
            'unique_users': 0,
            'current_index': 0
        }
        with open(STATS_FILE, 'w') as f:
            json.dump(stats, f)

# Load data from files
def load_data():
    with open(COUPONS_FILE, 'r') as f:
        coupons = json.load(f)
    
    with open(CLAIMS_FILE, 'r') as f:
        claims = json.load(f)
    
    with open(STATS_FILE, 'r') as f:
        stats = json.load(f)
    
    return coupons, claims, stats

# Save data to files
def save_data(coupons, claims, stats):
    with open(COUPONS_FILE, 'w') as f:
        json.dump(coupons, f)
    
    with open(CLAIMS_FILE, 'w') as f:
        json.dump(claims, f)
    
    with open(STATS_FILE, 'w') as f:
        json.dump(stats, f)

# Generate or retrieve a user token from cookies
def get_user_token(request, response):
    user_token = request.cookies.get('user_token')
    
    if not user_token:
        user_token = str(uuid.uuid4())
        response.set_cookie('user_token', user_token, max_age=30*24*60*60)  # 30 days
    
    return user_token

# Check if user can claim a coupon
def can_claim_coupon(user_token, claims):
    if user_token not in claims:
        return True, 0
    
    last_claim_time = claims[user_token]['last_claim_time']
    current_time = time.time()
    hour_in_seconds = 3600
    time_since_last_claim = current_time - last_claim_time
    
    if time_since_last_claim < hour_in_seconds:
        return False, hour_in_seconds - time_since_last_claim
    
    return True, 0

# Initialize data files
initialize_data_files()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/claim-coupon', methods=['POST'])
def claim_coupon():
    response = make_response()
    user_token = get_user_token(request, response)
    
    coupons, claims, stats = load_data()
    
    # Check if user can claim
    can_claim, time_remaining = can_claim_coupon(user_token, claims)
    if not can_claim:
        minutes = int(time_remaining // 60)
        seconds = int(time_remaining % 60)
        return jsonify({
            'success': False,
            'message': f'You can claim another coupon in {minutes}m {seconds}s.',
            'timeRemaining': time_remaining
        }), 200, {'Set-Cookie': response.headers.get('Set-Cookie', '')}
    
    # Check if coupons are available
    if not coupons:
        return jsonify({
            'success': False,
            'message': 'Sorry, all coupons have been claimed!'
        }), 200, {'Set-Cookie': response.headers.get('Set-Cookie', '')}
    
    # Parse optional coupon code from request
    data = request.get_json() or {}
    selected_coupon = data.get('couponCode')
    
    if selected_coupon:
        # Validate if the selected coupon exists in available coupons
        if selected_coupon not in coupons:
            return jsonify({
                'success': False,
                'message': 'Selected coupon is not available. Please choose a different coupon.'
            }), 200, {'Set-Cookie': response.headers.get('Set-Cookie', '')}
        coupon_code = selected_coupon
        # Remove selected coupon from the list
        coupons.remove(selected_coupon)
    else:
        # Fallback: remove the first available coupon
        coupon_code = coupons.pop(0)
    
    current_time = time.time()
    
    if user_token not in claims:
        claims[user_token] = {
            'claims': [],
            'last_claim_time': current_time
        }
        stats['unique_users'] += 1
    else:
        claims[user_token]['last_claim_time'] = current_time
    
    claims[user_token]['claims'].append({
        'coupon': coupon_code,
        'timestamp': current_time
    })
    
    stats['total_claimed'] += 1
    
    # Save updated data
    save_data(coupons, claims, stats)
    
    return jsonify({
        'success': True,
        'message': 'Coupon claimed successfully!',
        'couponCode': coupon_code
    }), 200, {'Set-Cookie': response.headers.get('Set-Cookie', '')}

@app.route('/api/check-status')
def check_status():
    response = make_response()
    user_token = get_user_token(request, response)
    
    coupons, claims, stats = load_data()
    
    can_claim, time_remaining = can_claim_coupon(user_token, claims)
    
    return jsonify({
        'canClaim': can_claim,
        'timeRemaining': time_remaining,
        'stats': {
            'totalClaimed': stats['total_claimed'],
            'uniqueUsers': stats['unique_users'],
            'remainingCoupons': len(coupons)
        }
    }), 200, {'Set-Cookie': response.headers.get('Set-Cookie', '')}

@app.route('/api/coupon-list')
def coupon_list():
    coupons, _, _ = load_data()
    return jsonify(coupons)

@app.route('/api/reset-demo', methods=['POST'])
def reset_demo():
    # In a real app, this would be protected by admin authentication
    os.remove(COUPONS_FILE)
    os.remove(CLAIMS_FILE)
    os.remove(STATS_FILE)
    initialize_data_files()
    
    response = make_response(jsonify({
        'success': True,
        'message': 'Demo has been reset. All data cleared.'
    }))
    
    response.delete_cookie('user_token')
    
    return response

if __name__ == '__main__':
    # app.run(debug=True)
    app.run()
