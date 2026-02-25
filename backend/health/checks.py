from redis_connection import RedisConnection
from db_connection import client
from system_utilities import ResultCode

def check_redis():
    """Redis bağlantısını kontrol eder"""
    try:
        health = RedisConnection.health_check()
        return health.get('code') == ResultCode.SUCCESS
    except:
        return False

def check_mongodb():
    """MongoDB bağlantısını kontrol eder"""
    try:
        # Basit bir ping veya server_info isteği
        client.admin.command('ping')
        return True
    except:
        return False