from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from system_utilities import ResultCode, system_handshake
from .service import get_esyalar, add_esya, update_esya, delete_esya
from rate_limiter import ceyiz_write_limit, ceyiz_read_limit

ceyiz_bp = Blueprint('ceyiz', __name__)


@ceyiz_bp.route('/api/ceyiz', methods=['GET'])
@jwt_required()
@ceyiz_read_limit()
def liste_getir():
    """Kullanicinin tum ceyiz esyalarini getirir"""
    try:
        user_id = get_jwt_identity()  # JWT'den al, frontenden degil
        esyalar = get_esyalar(user_id)

        return jsonify({
            "result": system_handshake(
                ResultCode.SUCCESS,
                data={"esyalar": esyalar}
            )
        })
    except Exception as e:
        return jsonify({
            "result": system_handshake(ResultCode.ERROR, error_message=str(e))
        }), 500


@ceyiz_bp.route('/api/ceyiz', methods=['POST'])
@jwt_required()
@ceyiz_write_limit()
def esya_ekle():
    """Yeni esya ekler"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()

        ad = data.get("ad", "").strip()
        if not ad:
            return jsonify({
                "result": system_handshake(ResultCode.INFO, message="Esya adi zorunludur")
            }), 400

        aciklama = data.get("aciklama", "")
        kategori = data.get("kategori", "diger")

        yeni_esya = add_esya(user_id, ad, aciklama, kategori)

        return jsonify({
            "result": system_handshake(
                ResultCode.SUCCESS,
                message="Esya eklendi",
                data=yeni_esya
            )
        }), 201

    except Exception as e:
        return jsonify({
            "result": system_handshake(ResultCode.ERROR, error_message=str(e))
        }), 500


@ceyiz_bp.route('/api/ceyiz/<esya_id>', methods=['PUT'])
@jwt_required()
@ceyiz_write_limit()
def esya_guncelle(esya_id):
    """Mevcut esyayi gunceller"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()

        ad = data.get("ad", "").strip()
        if not ad:
            return jsonify({
                "result": system_handshake(ResultCode.INFO, message="Esya adi zorunludur")
            }), 400

        aciklama = data.get("aciklama", "")
        kategori = data.get("kategori", "diger")

        guncellenen = update_esya(user_id, esya_id, ad, aciklama, kategori)

        if guncellenen is None:
            return jsonify({
                "result": system_handshake(ResultCode.ERROR, message="Esya bulunamadi")
            }), 404

        return jsonify({
            "result": system_handshake(
                ResultCode.SUCCESS,
                message="Esya guncellendi",
                data=guncellenen
            )
        })

    except Exception as e:
        return jsonify({
            "result": system_handshake(ResultCode.ERROR, error_message=str(e))
        }), 500


@ceyiz_bp.route('/api/ceyiz/<esya_id>', methods=['DELETE'])
@jwt_required()
@ceyiz_write_limit()
def esya_sil(esya_id):
    """Esyayi siler"""
    try:
        user_id = get_jwt_identity()
        silindi = delete_esya(user_id, esya_id)

        if not silindi:
            return jsonify({
                "result": system_handshake(ResultCode.ERROR, message="Esya bulunamadi")
            }), 404

        return jsonify({
            "result": system_handshake(
                ResultCode.SUCCESS,
                message="Esya silindi"
            )
        })

    except Exception as e:
        return jsonify({
            "result": system_handshake(ResultCode.ERROR, error_message=str(e))
        }), 500
