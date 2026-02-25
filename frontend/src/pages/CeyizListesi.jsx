import Swal from 'sweetalert2';
import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ceyizAPI } from '../services/api';
import ResultCode from '../constants/resultcodes';
import '../App.css';

const KATEGORILER = [
    { id: 'mutfak', label: 'Mutfak', emoji: '🍳' },
    { id: 'yatak', label: 'Yatak Odası', emoji: '🛏️' },
    { id: 'banyo', label: 'Banyo', emoji: '🚿' },
    { id: 'salon', label: 'Salon', emoji: '🛋️' },
    { id: 'elektronik', label: 'Elektronik', emoji: '📺' },
    { id: 'diger', label: 'Diger', emoji: '📦' },
];

const KATEGORI_RENK = {
    mutfak: { bg: '#FFF3E0', border: '#FF9800', text: '#E65100' },
    yatak: { bg: '#F3E5F5', border: '#9C27B0', text: '#6A1B9A' },
    banyo: { bg: '#E0F7FA', border: '#00BCD4', text: '#00695C' },
    salon: { bg: '#E8F5E9', border: '#4CAF50', text: '#2E7D32' },
    elektronik: { bg: '#E3F2FD', border: '#2196F3', text: '#1565C0' },
    diger: { bg: '#F5F5F5', border: '#9E9E9E', text: '#424242' },
};



function timestampToDate(ts) {
    if (!ts) return null;
    return new Date(ts * 1000).toLocaleString();
}



function CeyizListesi() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [esyalar, setEsyalar] = useState([]);
    const [yukleniyor, setYukleniyor] = useState(true);
    const [modalAcik, setModalAcik] = useState(false);
    const [duzenleHedef, setDuzenleHedef] = useState(null);
    const [form, setForm] = useState({ ad: '', aciklama: '', kategori: 'diger' });
    const [formHata, setFormHata] = useState('');
    const [kaydetYukleniyor, setKaydetYukleniyor] = useState(false);
    const [aramaMetni, setAramaMetni] = useState('');
    const [aktifFiltre, setAktifFiltre] = useState('hepsi');

    // --- SAYFA YUKLENINCE CEYIZ LISTESINI CEK ---
    useEffect(() => {
        listeGetir();
    }, []);

    const listeGetir = async () => {
        setYukleniyor(true);
        try {
            const response = await ceyizAPI.getEsyalar();
            if (response.result.code === ResultCode.SUCCESS) {
                setEsyalar(response.result.data.esyalar);
            }
        } catch (error) {
            console.error('Liste getirme hatasi:', error);
            Swal.fire({
                title: 'Hata',
                text: 'Liste yuklenemedi!',
                icon: 'error',
                confirmButtonText: 'Tamam'
            });
        } finally {
            setYukleniyor(false);
        }
    };

    // --- LOGOUT ---
    const handleLogout = async () => {
        const result = await Swal.fire({
            title: 'Emin misin?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Evet, cikis yap',
            cancelButtonText: 'Iptal',
            confirmButtonColor: 'rgba(5,38,70)',
        });
        if (result.isConfirmed) {
            await logout();
            navigate('/');
        }
    };

    // --- MODAL ---
    const modalAc = (esya = null) => {
        if (esya) {
            setDuzenleHedef(esya._id);
            setForm({ ad: esya.ad, aciklama: esya.aciklama, kategori: esya.kategori });
        } else {
            setDuzenleHedef(null);
            setForm({ ad: '', aciklama: '', kategori: 'diger' });
        }
        setFormHata('');
        setModalAcik(true);
    };

    const modalKapat = () => {
        setModalAcik(false);
        setDuzenleHedef(null);
        setFormHata('');
    };

    // --- KAYDET ---
    const handleKaydet = async () => {
        if (!form.ad.trim()) {
            setFormHata('Esya adi zorunludur.');
            return;
        }

        setKaydetYukleniyor(true);
        try {
            if (duzenleHedef !== null) {
                // Guncelle
                const response = await ceyizAPI.updateEsya(
                    duzenleHedef,
                    form.ad,
                    form.aciklama,
                    form.kategori
                );
                if (response.result.code === ResultCode.SUCCESS) {
                    setEsyalar(prev =>
                        prev.map(e => e._id === duzenleHedef ? response.result.data : e)
                    );
                    Swal.fire({ title: 'Guncellendi!', icon: 'success', timer: 1200, showConfirmButton: false });
                }
            } else {
                // Yeni ekle
                const response = await ceyizAPI.addEsya(form.ad, form.aciklama, form.kategori);
                if (response.result.code === ResultCode.SUCCESS) {
                    setEsyalar(prev => [...prev, response.result.data]);
                    Swal.fire({ title: 'Eklendi!', icon: 'success', timer: 1200, showConfirmButton: false });
                }
            }
            modalKapat();
        } catch (error) {
            console.error('Kaydet hatasi:', error);
            Swal.fire({ title: 'Hata', text: 'Islem basarisiz!', icon: 'error', confirmButtonText: 'Tamam' });
        } finally {
            setKaydetYukleniyor(false);
        }
    };

    // --- SIL ---
    const handleSil = async (_id) => {
        const result = await Swal.fire({
            title: 'Emin misin?',
            text: 'Bu esyayi silmek istedigine emin misin?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Evet, sil',
            cancelButtonText: 'Iptal',
            confirmButtonColor: '#d33',
        });
        if (result.isConfirmed) {
            try {
                const response = await ceyizAPI.deleteEsya(_id);
                if (response.result.code === ResultCode.SUCCESS) {
                    setEsyalar(prev => prev.filter(e => e._id !== _id));
                    Swal.fire({ title: 'Silindi!', icon: 'success', timer: 1000, showConfirmButton: false });
                }
            } catch (error) {
                Swal.fire({ title: 'Hata', text: 'Silme basarisiz!', icon: 'error', confirmButtonText: 'Tamam' });
            }
        }
    };

    // --- FILTRELE / ARA ---
    const gorunenler = esyalar.filter(e => {
        const aramaUygun = e.ad.toLowerCase().includes(aramaMetni.toLowerCase()) ||
            e.aciklama.toLowerCase().includes(aramaMetni.toLowerCase());
        const filtreUygun = aktifFiltre === 'hepsi' || e.kategori === aktifFiltre;
        return aramaUygun && filtreUygun;
    });

    const kategoriSay = (kid) => esyalar.filter(e => e.kategori === kid).length;

    return (
        <div className="dashboard-page">
            {/* HEADER */}
            <div className="dashboard-header">
                <h2>Ceyiz Listem</h2>
                <div className="dashboard-user">
                    <span>Hosgeldin, {user?.username}</span>
                    <button onClick={() => navigate('/dashboard')}>Dashboard</button>
                    <button onClick={handleLogout}>Cikis Yap</button>
                </div>
            </div>

            <div className="ceyiz-page">

                {/* UST BAR */}
                <div className="ceyiz-topbar">
                    <div className="ceyiz-arama-wrap">
                        <span className="ceyiz-arama-icon">🔍</span>
                        <input
                            className="ceyiz-arama"
                            type="text"
                            placeholder="Esya ara..."
                            value={aramaMetni}
                            onChange={e => setAramaMetni(e.target.value)}
                        />
                    </div>
                    <button className="ceyiz-ekle-btn" onClick={() => modalAc()}>
                        + Esya Ekle
                    </button>
                </div>

                {/* KATEGORI FILTRELERI */}
                <div className="ceyiz-filtreler">
                    <button
                        className={`ceyiz-filtre-btn ${aktifFiltre === 'hepsi' ? 'aktif' : ''}`}
                        onClick={() => setAktifFiltre('hepsi')}
                    >
                        Tumu <span className="filtre-sayi">{esyalar.length}</span>
                    </button>
                    {KATEGORILER.map(k => (
                        <button
                            key={k.id}
                            className={`ceyiz-filtre-btn ${aktifFiltre === k.id ? 'aktif' : ''}`}
                            onClick={() => setAktifFiltre(k.id)}
                        >
                            {k.emoji} {k.label}
                            {kategoriSay(k.id) > 0 && (
                                <span className="filtre-sayi">{kategoriSay(k.id)}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* LISTE */}
                {yukleniyor ? (
                    <div className="ceyiz-bos">
                        <p className="ceyiz-bos-emoji">⏳</p>
                        <p className="ceyiz-bos-text">Yukleniyor...</p>
                    </div>
                ) : (
                    <div className="ceyiz-liste">
                        {gorunenler.length === 0 ? (
                            <div className="ceyiz-bos">
                                <p className="ceyiz-bos-emoji">🛒</p>
                                <p className="ceyiz-bos-text">
                                    {esyalar.length === 0 ? 'Henuz esya eklenmedi' : 'Arama sonucu bulunamadi'}
                                </p>
                                {esyalar.length === 0 && (
                                    <button className="ceyiz-ekle-btn" onClick={() => modalAc()}>
                                        Ilk esyayi ekle
                                    </button>
                                )}
                            </div>
                        ) : (
                            gorunenler.map((esya, index) => {
                                const renk = KATEGORI_RENK[esya.kategori] || KATEGORI_RENK.diger;
                                const kat = KATEGORILER.find(k => k.id === esya.kategori);
                                return (
                                    <div
                                        key={esya._id}
                                        className="ceyiz-satir"
                                        style={{ borderLeft: `4px solid ${renk.border}` }}
                                    >
                                        <div className="ceyiz-sira" style={{ color: renk.border }}>
                                            {String(index + 1).padStart(2, '0')}
                                        </div>
                                        <div className="ceyiz-ikon" style={{ background: renk.bg, color: renk.text }}>
                                            {kat?.emoji || '📦'}
                                        </div>
                                        <div className="ceyiz-icerik">
                                            <span className="ceyiz-ad">{esya.ad}</span>
                                            {esya.aciklama && (
                                                <span className="ceyiz-aciklama">{esya.aciklama}</span>
                                            )}
                                        </div>
                                        <div
                                            className="ceyiz-etiket"
                                            style={{ background: renk.bg, color: renk.text, border: `1px solid ${renk.border}` }}
                                        >
                                            {kat?.label}
                                        </div>
                                        <div className="ceyiz-aksiyonlar">
                                            <button className="ceyiz-btn-duzenle" onClick={() => modalAc(esya)} title="Duzenle">✏️</button>
                                            <button className="ceyiz-btn-sil" onClick={() => handleSil(esya._id)} title="Sil">🗑️</button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {esyalar.length > 0 && (
                    <div className="ceyiz-ozet">
                        Toplam <strong>{esyalar.length}</strong> esya
                        {aktifFiltre !== 'hepsi' && ` - Gosterilen: ${gorunenler.length}`}
                    </div>
                )}
            </div>

            {/* MODAL */}
            {modalAcik && (
                <div className="modal-overlay" onClick={modalKapat}>
                    <div className="modal-kart" onClick={e => e.stopPropagation()}>
                        <div className="modal-baslik">
                            <h2>{duzenleHedef !== null ? 'Esyayi Duzenle' : 'Yeni Esya Ekle'}</h2>
                            <button className="modal-kapat" onClick={modalKapat}>X</button>
                        </div>
                        <div className="modal-form">
                            <label className="modal-label">Esya Adi <span className="zorunlu">*</span></label>
                            <input
                                className={`modal-input ${formHata ? 'hata' : ''}`}
                                type="text"
                                placeholder="or: Tost Makinesi"
                                value={form.ad}
                                onChange={e => { setForm(f => ({ ...f, ad: e.target.value })); setFormHata(''); }}
                                autoFocus
                            />
                            {formHata && <p className="form-hata-mesaj">{formHata}</p>}

                            <label className="modal-label">Aciklama (opsiyonel)</label>
                            <textarea
                                className="modal-textarea"
                                placeholder="or: Cift tarafli, siyah renk"
                                value={form.aciklama}
                                onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))}
                                rows={3}
                            />

                            <label className="modal-label">Kategori</label>
                            <div className="modal-kategoriler">
                                {KATEGORILER.map(k => {
                                    const renk = KATEGORI_RENK[k.id];
                                    return (
                                        <button
                                            key={k.id}
                                            type="button"
                                            className={`modal-kat-btn ${form.kategori === k.id ? 'secili' : ''}`}
                                            style={form.kategori === k.id
                                                ? { background: renk.bg, border: `2px solid ${renk.border}`, color: renk.text }
                                                : {}
                                            }
                                            onClick={() => setForm(f => ({ ...f, kategori: k.id }))}
                                        >
                                            {k.emoji} {k.label}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="modal-butonlar">
                                <button className="modal-iptal" onClick={modalKapat}>Iptal</button>
                                <button
                                    className="modal-kaydet"
                                    onClick={handleKaydet}
                                    disabled={kaydetYukleniyor}
                                >
                                    {kaydetYukleniyor ? 'Kaydediliyor...' : (duzenleHedef !== null ? 'Guncelle' : 'Kaydet')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CeyizListesi;
