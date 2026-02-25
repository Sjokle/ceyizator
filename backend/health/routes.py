from flask import Blueprint, jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from system_utilities import ResultCode, system_handshake

# BURASI KRİTİK: Kendi check fonksiyonlarını buradan import et
from .checks import check_mongodb, check_redis 

health_bp = Blueprint('health', __name__)

@health_bp.route('/api/health', methods=['GET'])
def health_status():
    # 1. ERİŞİM KONTROLÜ (Docker veya Admin mi?)
    is_internal = (request.remote_addr == '127.0.0.1')
    is_admin = False

    if not is_internal:
        try:
            verify_jwt_in_request(optional=True)
            claims = get_jwt()
            if claims and claims.get('role') == 'admin':
                is_admin = True
        except:
            pass

    # Yetkisiz erişimi engelle
    if not (is_internal or is_admin):
        return jsonify({"result": system_handshake(ResultCode.INFO)}), 403

    # 2. MEVCUT FONKSİYONLARI ÇALIŞTIR
    mongo_ok = check_mongodb()
    redis_ok = check_redis()
    
    is_all_ok = mongo_ok and redis_ok
    
    # 3. SONUCU PAKETLE
    return jsonify({
        "result": system_handshake(
            resultCode=ResultCode.SUCCESS if is_all_ok else ResultCode.ERROR,
            message="Health check completed",
            data={"mongodb": mongo_ok, "redis": redis_ok}
        )
    })