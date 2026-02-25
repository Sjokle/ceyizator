#import eventlet
#eventlet.monkey_patch()
from flask import Flask, request, jsonify, make_response, session
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_jwt_extended import (
    create_access_token, 
    create_refresh_token,
    jwt_required, 
    get_jwt_identity,
    get_jwt,
    set_access_cookies,
    set_refresh_cookies,
    unset_jwt_cookies
)
from config import Config
from user_enterance import user_exists, user_add_check
from core import validate_payload
from system_utilities import ResultCode, system_handshake
from key_rotation import rotate_master_key
from services.api import get_stories, get_data_by_api, get_data_by_html
from rate_limiter import(
    init_limiter, 
    login_limit, 
    register_limit, 
    api_limit, 
    exempt_from_limit
)
from redis_connection import RedisConnection
from jwt_manager import init_jwt, add_token_to_blacklist
import threading
import time
from datetime import timedelta
from werkzeug.middleware.proxy_fix import ProxyFix
from health.routes import health_bp
from ceyiz.routes import ceyiz_bp

app = Flask(__name__)

app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1, x_prefix=1)

app.config['SECRET_KEY'] = Config.SECRET_KEY


app.config['JWT_SECRET_KEY'] = Config.JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(seconds=Config.JWT_ACCESS_TOKEN_EXPIRES)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(seconds=Config.JWT_REFRESH_TOKEN_EXPIRES)
app.config['JWT_TOKEN_LOCATION'] = Config.JWT_TOKEN_LOCATION
app.config['JWT_COOKIE_SECURE'] = Config.JWT_COOKIE_SECURE
app.config['JWT_COOKIE_CSRF_PROTECT'] = Config.JWT_COOKIE_CSRF_PROTECT
app.config['JWT_COOKIE_SAMESITE'] = Config.JWT_COOKIE_SAMESITE


app.config['SESSION_TYPE'] = Config.SESSION_TYPE
app.config['SESSION_COOKIE_SECURE'] = Config.SESSION_COOKIE_SECURE
app.config['SESSION_COOKIE_HTTPONLY'] = Config.SESSION_COOKIE_HTTPONLY
app.config['SESSION_COOKIE_SAMESITE'] = Config.SESSION_COOKIE_SAMESITE
app.config['PERMANENT_SESSION_LIFETIME'] = Config.PERMANENT_SESSION_LIFETIME


CORS(app, origins=Config.CORS_ORIGINS, async_mode=Config.SOCKETIO_ASYNC_MODE, supports_credentials=True)

init_limiter(app)
init_jwt(app) 


socketio = SocketIO(
    app,
    cors_allowed_origins= Config.SOCKETIO_CORS_ALLOWED_ORIGINS,
    async_mode=Config.SOCKETIO_ASYNC_MODE,
    logger=True, 
    engineio_logger=True
)

app.register_blueprint(ceyiz_bp)
app.register_blueprint(health_bp)


@app.route("/api/user_check", methods=["POST"])
@login_limit()
def user_check():
    data = request.get_json()
    
    responce = validate_payload(data)
    
    if responce['code'] != ResultCode.SUCCESS:
        return jsonify({"result": responce})
    
    result = user_exists(data.get("username"), data.get("password"), ip=request.remote_addr)
    if result['code'] == ResultCode.SUCCESS:
        username = data.get("username")
        
        user_info = result.get('data', {})
        user_role = user_info.get('role', 'user')

        access_token = create_access_token(identity=username, 
                                          additional_claims={"role": user_role})
        refresh_token = create_refresh_token(identity=username)

        response = make_response(jsonify({"result": result}))

        set_access_cookies(response, access_token)
        set_refresh_cookies(response, refresh_token)

        return response
    else:
        return jsonify({"result": result})



@app.route("/api/user_add", methods=["POST"])
@register_limit()
def user_add():

    data = request.get_json()
    responce = validate_payload(data)
    
    if responce['code'] == ResultCode.SUCCESS: 
        result = user_add_check(data.get("username"), data.get("password"), data.get("confirmPassword"), data.get("email"))
        return jsonify({"result": result})
    else:
        return jsonify({"result": responce})


@app.route("/api/logout", methods=["POST"])
def logout():
    """
    Kullanıcı çıkış yapar - TÜM token'ları blacklist'e ekler
    """
    try:        
        blacklisted_tokens = []
        
        access_token = request.cookies.get('access_token_cookie')
        if access_token:
            try:
                decoded_access = decode_token_from_cookie(access_token)
                if decoded_access:
                    jti = decoded_access['jti']
                    expires = app.config["JWT_ACCESS_TOKEN_EXPIRES"]
                    add_token_to_blacklist(jti, int(expires.total_seconds()))
                    blacklisted_tokens.append('access_token')
            except Exception as e:
                print(f"Access token blacklist hatası: {e}")
        
        refresh_token = request.cookies.get('refresh_token_cookie')
        if refresh_token:
            try:
                decoded_refresh = decode_token_from_cookie(refresh_token)
                if decoded_refresh:
                    jti = decoded_refresh['jti']
                    expires = app.config["JWT_REFRESH_TOKEN_EXPIRES"]
                    add_token_to_blacklist(jti, int(expires.total_seconds()))
                    blacklisted_tokens.append('refresh_token')
            except Exception as e:
                print(f"Refresh token blacklist hatası: {e}")
        
        response = make_response(
            jsonify({
                "result": system_handshake(
                    ResultCode.SUCCESS, 
                    "Çıkış yapıldı",
                    data={"blacklisted": blacklisted_tokens}
                )
            })
        )
        
        unset_jwt_cookies(response)
        
        return response
        
    except Exception as e:
        print(f"Logout hatası: {e}")
        return jsonify({
            "result": system_handshake(ResultCode.ERROR, error_message=str(e))
        }), 500





@app.route("/api/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    """Access token yenileme"""
    try:
        current_user = get_jwt_identity()
        
        new_access_token = create_access_token(identity=current_user)
        
        response = make_response(jsonify({
            "result": system_handshake(ResultCode.SUCCESS, "Token yenilendi")
        }))
        
        set_access_cookies(response, new_access_token)
        
        return response
    except Exception as e:
        return jsonify({
            "result": system_handshake(ResultCode.ERROR, error_message=str(e))
        }), 500


@app.route("/api/api/stories", methods=["GET"])
@jwt_required() 
@api_limit()
def api_get_stories():
    """Stories endpoint - JWT ile korunuyor"""
    current_user = get_jwt_identity()  
    
    source = request.args.get("source", "api")
    result = get_stories(source)
    return jsonify({"result": result})


@app.route("/api/user/me", methods=["GET"])
@jwt_required()
def get_current_user():
    """Mevcut kullanıcı bilgisi"""
    current_user = get_jwt_identity()
    claims = get_jwt()  

    
    from db_connection import client
    db = client["BadBoys"]
    user = db["users"].find_one({"username": current_user}, {"password_hash": 0, "salt": 0})
    
    if user:
        user['_id'] = str(user['_id'])
        user['role'] = claims.get('role', 'user')
        return jsonify({
            "result": system_handshake(ResultCode.SUCCESS, data=user)
        })
    else:
        return jsonify({
            "result": system_handshake(ResultCode.ERROR, "Kullanıcı bulunamadı")
        }), 404




@app.route("/api/", methods=["GET"])
@exempt_from_limit()
def index():
    return jsonify({"status": "OK"})

@app.route("/api/admin/redis-stats", methods=["GET"])
@api_limit()
def redis_stats():
    """Redis istatistiklerini döndür"""
    stats = RedisConnection.get_stats()
    return jsonify({"result": stats})

@app.route("/api/admin/redis-health", methods=["GET"])
@exempt_from_limit()
def redis_health():
    """Redis health check"""
    health = RedisConnection.health_check()
    return jsonify({"result": health})

def key_rotation_scheduler():
    while True:
        try:
            print("[KEY_ROTATION] Key Rotation Başladı.")
            rotate_master_key()
            print("[KEY_ROTATION] Key Rotation Sonlandı.")
        except Exception as e:
            pass
        time.sleep(Config.KEY_ROTATION_INTERVAL)

def databot_fetch_scheduler():
    while True:
        print("[DATA_BOT] Veri çekimi başlatılıyor...")
        try:
            print("[API_DATA] Veri çekimi başlatılıyor...")
            get_data_by_api()
            latest_api = get_stories('api')
            socketio.emit("new_stories", latest_api)
            print("[API_DATA] Veri çekimi tamamlandı...")
            
            print("[HTML_DATA] Veri çekimi başlatılıyor...")
            get_data_by_html()
            latest_html = get_stories('html')
            socketio.emit("new_stories_html", latest_html)
            print("[HTML_DATA] Veri çekimi tamamlandı...")
        except:
            pass
        print("[DATA_BOT] API ve HTML veri çekimi tamamlandı.")
        time.sleep(Config.DATA_FETCH_INTERVAL)

def start_background_tasks():
    time.sleep(2)
    threading.Thread(target=key_rotation_scheduler, daemon=True).start()
    time.sleep(2)
    threading.Thread(target=databot_fetch_scheduler, daemon=True).start()

    
print(Config.ACTIVE_ENV_FILE)

try:
    redis_health = RedisConnection.health_check()
    print(f"Redis Durumu: {redis_health['code']}")
    
except Exception as e:
    print(f"Redis hatası: {str(e)}")

print("[SERVER] Arka plan botu başlatılıyor...")
threading.Thread(target=start_background_tasks, daemon=True).start()


if __name__ == "__main__":
    socketio.run(app, debug=Config.DEBUG, port=5000, host="0.0.0.0", use_reloader=False)
