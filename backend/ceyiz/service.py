from db_connection import client
from bson import ObjectId
from core import now_ts



db = client["BadBoys"]
collection = db["ceyiz"]

def get_esyalar(user_id: str):
    """Kullanicinin tum esyalarini getirir"""
    try:
        esyalar = list(
            collection.find(
                {"user_id": user_id},
                {"__v": 0}
            ).sort("sira", 1)
        )
        for e in esyalar:
            e["_id"] = str(e["_id"])
        return esyalar
    except Exception as e:
        raise Exception(f"Listeleme hatasi: {str(e)}")


def add_esya(user_id: str, ad: str, aciklama: str = "", kategori: str = "diger"):
    """Yeni esya ekler"""
    try:
        # En yuksek sira numarasini bul
        son = collection.find_one(
            {"user_id": user_id},
            sort=[("sira", -1)]
        )
        yeni_sira = (son["sira"] + 1) if son else 1

        yeni_esya = {
            "user_id":    user_id,
            "ad":         ad.strip(),
            "aciklama":   aciklama.strip(),
            "kategori":   kategori,
            "sira":       yeni_sira,
            "created_at": now_ts(),
            "updated_at": now_ts(),
        }

        result = collection.insert_one(yeni_esya)
        yeni_esya["_id"] = str(result.inserted_id)

        return yeni_esya
    except Exception as e:
        raise Exception(f"Ekleme hatasi: {str(e)}")


def update_esya(user_id: str, esya_id: str, ad: str, aciklama: str = "", kategori: str = "diger"):
    """Mevcut esyayi gunceller"""
    try:
        result = collection.update_one(
            {
                "_id":     ObjectId(esya_id),
                "user_id": user_id        
            },
            {
                "$set": {
                    "ad":         ad.strip(),
                    "aciklama":   aciklama.strip(),
                    "kategori":   kategori,
                    "updated_at": now_ts(),
                }
            }
        )

        if result.matched_count == 0:
            return None 

        guncellenen = collection.find_one({"_id": ObjectId(esya_id)})
        guncellenen["_id"] = str(guncellenen["_id"])

        return guncellenen
    except Exception as e:
        raise Exception(f"Guncelleme hatasi: {str(e)}")


def delete_esya(user_id: str, esya_id: str):
    """Esyayi siler"""
    try:
        result = collection.delete_one(
            {
                "_id":     ObjectId(esya_id),
                "user_id": user_id           
            }
        )
        return result.deleted_count > 0
    except Exception as e:
        raise Exception(f"Silme hatasi: {str(e)}")
