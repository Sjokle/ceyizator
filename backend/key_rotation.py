import os
from core import now_ts
from dotenv import set_key, find_dotenv, dotenv_values, load_dotenv
from Crypto.Cipher import DES3
from db_connection import client
from config import Config


# =============================
#  CONFIGURATION
# =============================

DB_NAME = "BadBoys"
DEK_COLLECTION = "DES3_DEKS"
DEK_LOG_COLLECTION = "DES3_DEKS_LOGS"

# .env.live dosyasının tam yolunu bul
ENV_PATH = find_dotenv(Config.ACTIVE_ENV_FILE, raise_error_if_not_found=False)
if not ENV_PATH:
    # Alternatif yol - mevcut dizinde ara
    ENV_PATH = os.path.join(os.getcwd(), Config.ACTIVE_ENV_FILE)
    if not os.path.exists(ENV_PATH):
        # Son çare: /app dizininde ara
        ENV_PATH = os.path.join('/app', Config.ACTIVE_ENV_FILE)

print(f"Kullanılan .env dosyası: {ENV_PATH}")


# =============================
#  DATABASE OPERATIONS
# =============================

def get_latest_dek(collection):
    """Veritabanından en son oluşturulan DEK kaydını getirir."""
    key = collection.find_one(sort=[("_id", -1)])
    return key


def insert_dek(collection, dek_hex, dek_id):
    """Yeni DEK kaydını MongoDB'ye ekler."""

    dek_doc = {
        "dek": dek_hex,
        "create_date": now_ts(),
        "status": "A",
        "rotate_date": None,
        "3DES_DEK_ID": dek_id
    }
    collection.insert_one(dek_doc)

    
def deactivate_old_dek(collection, dek_id):
    """Eski aktif DEK kaydını pasif hale getirir."""
    collection.update_one(
        {"3DES_DEK_ID": dek_id},
        {"$set": {"status": "P", "rotate_date": now_ts()}}
    )


def logger(collection, ID=None, stepcode=None, stepname=None, message=None):
    try:
        db = client["BadBoys"]
        db["DES3_DEKS_LOGS"].insert_one({
            "3DES_DEKS_ID": ID,
            "stepcode": stepcode,
            "stepname": stepname,
            "message": message
        })
    except Exception as e:
        print("Logger hatası:", e)

# =============================
#  ENCRYPTION UTILITIES
# =============================

def des3_encrypt(key: bytes, data: bytes) -> bytes:
    """3DES ile veri şifreleme"""
    cipher = DES3.new(key, DES3.MODE_ECB)
    return cipher.encrypt(data)


def des3_decrypt(key: bytes, data: bytes) -> bytes:
    """3DES ile veri çözme"""
    cipher = DES3.new(key, DES3.MODE_ECB)
    return cipher.decrypt(data)


# =============================
#  ENVIRONMENT UTILITIES
# =============================


def read_env_value(key: str, path="/app/.env.live") -> str:
    with open(path) as f:
        for line in f:
            if line.startswith(key + "="):
                return line.split("=",1)[1].strip()
    raise KeyError(f"{key} not found")


def get_master_key() -> bytes:
    """Env dosyasından MASTER_3DES_KEY değerini okur."""
    value = read_env_value("MASTER_3DES_KEY")
    return bytes.fromhex(value)

def reload_config():
    """Config'i yeniden yükle - dosya değişikliğini algıla"""
    load_dotenv(Config.ACTIVE_ENV_FILE, override=True)
    print(f"Config yeniden yüklendi")

def update_env_master_key(new_key_hex: str):
    """Yeni master key'i .env dosyasına yazar."""
    try:

        print(f"Yeni key yazılıyor: {new_key_hex[:20]}...")
        
        # Dosyanın var olduğundan ve yazılabilir olduğundan emin ol
        if not os.path.exists(ENV_PATH):
            raise FileNotFoundError(f"{ENV_PATH} dosyası bulunamadı!")
        
        # Dosya izinlerini kontrol et
        if not os.access(ENV_PATH, os.W_OK):
            raise PermissionError(f"{ENV_PATH} dosyası yazılabilir değil!")
        
        # Mevcut .env içeriğini oku
        with open(ENV_PATH, 'r') as f:
            lines = f.readlines()
        
        # MASTER_3DES_KEY satırını bul ve güncelle
        updated = False
        new_lines = []
        
        for line in lines:
            if line.startswith('MASTER_3DES_KEY='):
                # Eski değeri yeni ile değiştir (tek tırnak olmadan)
                new_lines.append(f'MASTER_3DES_KEY={new_key_hex}\n')
                updated = True
                print(f"MASTER_3DES_KEY satırı güncellendi")
            else:
                new_lines.append(line)
        
        # Eğer MASTER_3DES_KEY satırı yoksa ekle
        if not updated:
            new_lines.append(f'MASTER_3DES_KEY={new_key_hex}\n')
            print(f"MASTER_3DES_KEY satırı eklendi")
        
        # Dosyayı yaz
        with open(ENV_PATH, 'w') as f:
            f.writelines(new_lines)
        
        # Disk'e yazılmasını zorla
        os.sync()
        
        print(f"{Config.ACTIVE_ENV_FILE} dosyası başarıyla güncellendi!")
        
        # Config'i yeniden yükle
        reload_config()
        
        # Güncellemeyi doğrula
        verify_update(new_key_hex)
        
        
    except Exception as e:
        print(f".env dosyası güncellenirken hata oluştu: {e}")
        raise

def verify_update(expected_key_hex: str):
    """Güncellemenin başarılı olup olmadığını kontrol et."""
    try:
        # Dosyayı tekrar oku
        env_values = dotenv_values(ENV_PATH)
        actual_key = env_values.get('MASTER_3DES_KEY', '')
        
        # Tek tırnakları temizle
        if actual_key and actual_key.startswith("'") and actual_key.endswith("'"):
            actual_key = actual_key[1:-1]
        
        if actual_key == expected_key_hex:
            print(f"Güncelleme doğrulandı: Key başarıyla yazıldı")
            return True
        else:
            print(f"Uyarı: Yazılan key farklı!")
            print(f"   Beklenen: {expected_key_hex}...")
            print(f"   Gerçek  : {actual_key}...")
            return False
    except Exception as e:
        print(f"Doğrulama hatası: {e}")
        return False


# =============================
#  ROTATION PROCESS
# =============================

def rotate_master_key():
    """Master key rotasyon işlemini gerçekleştirir."""
    db = client[DB_NAME]
    dek_col = db[DEK_COLLECTION]
    log_col = db[DEK_LOG_COLLECTION]
    
    # En son DEK'i getir
    latest_dek = get_latest_dek(dek_col)
    new_dek_id = latest_dek["3DES_DEK_ID"] + 1

    # MASTER KEY'i oku
    master_key = get_master_key()

    logger(log_col, new_dek_id, 1, "Başlangıç", f"{new_dek_id-1} id'li Eski DEK alındı. MASTER_3DES_KEY alındı.")

    # MASTER KEY çöz
    decrypted_master = des3_decrypt(bytes.fromhex(latest_dek["dek"]), master_key)

    logger(log_col, new_dek_id, 2, "Master Key Şifresini Çöz", f"Ham Master Key: {decrypted_master.hex()[-3:]}")

    # Yeni DEK oluştur
    new_dek = os.urandom(24)

    # Yeni DEK ile master key'i yeniden şifrele
    encrypted_master = des3_encrypt(new_dek, decrypted_master)
    encrypted_master_hex = encrypted_master.hex()

    logger(log_col, new_dek_id, 3, "Master Key Şifrele",
           f"Master key şifrelendi. Yeni DEK: {new_dek.hex()[-3:]}")

    # Yeni master key'i .env'ye yaz
    update_env_master_key(encrypted_master_hex)
    logger(log_col, new_dek_id, 4, "Şifrelenmiş Master Keyi yaz", "Yeni Master Key .env dosyasına yazıldı.")

    # Yeni DEK loglarını kaydet
    insert_dek(dek_col, new_dek.hex(), new_dek_id)

    print("DEK ve encrypted MASTER key başarıyla kaydedildi.")
    logger(log_col, new_dek_id, 5, "Master Key Rotasyonunu Tamamla.", "Master key rotasyonu başarıyla tamamlandı.")

    # Eski dek kayıdını pasife al.
    deactivate_old_dek(dek_col, new_dek_id-1)
    
    print(f"{new_dek_id-1} id'li Eski DEK kayıdı pasife alındı.")
    logger(log_col, new_dek_id, 6, "Tamamlandı", f"{new_dek_id-1} id'li Eski DEK kayıdı pasife alındı.")

    return encrypted_master_hex, new_dek.hex()


# =============================
#  MAIN
# =============================

if __name__ == "__main__":
    print(f"\n{'='*60}")
    print(f"MASTER KEY ROTATION BAŞLIYOR")
    print(f"{'='*60}\n")
    
    new_master_key, new_dek = rotate_master_key()
    
    print(f"\n{'='*60}")
    print(f"ROTASYON TAMAMLANDI!")
    print(f"{'='*60}")
    print(f"\nYeni Master Key: {new_master_key}")
    print(f"Yeni DEK: {new_dek}\n")