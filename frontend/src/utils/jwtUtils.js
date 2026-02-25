/**
 * JWT Token Utility Functions
 * JWT token'larından bilgi çıkarmak için yardımcı fonksiyonlar
 */

/**
 * Cookie'den JWT token'ı alır
 * @param {string} cookieName - Cookie ismi (örn: 'access_token_cookie')
 * @returns {string|null} - Token string veya null
 */
export const getTokenFromCookie = (cookieName = 'access_token_cookie') => {
    try {
        const cookies = document.cookie.split(';');
        const tokenCookie = cookies.find(c => c.trim().startsWith(`${cookieName}=`));
        
        if (!tokenCookie) return null;
        
        const token = tokenCookie.split('=')[1];
        return token || null;
    } catch (error) {
        console.error('Cookie okuma hatası:', error);
        return null;
    }
};

/**
 * JWT token'ı decode eder (Base64)
 * @param {string} token - JWT token string
 * @returns {object|null} - Decode edilmiş payload veya null
 */
export const decodeJWT = (token) => {
    try {
        if (!token) return null;
        
        // JWT formatı: header.payload.signature
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        // Payload kısmını al (index 1)
        const payload = parts[1];
        
        // Base64 decode
        const decoded = JSON.parse(atob(payload));
        
        return decoded;
    } catch (error) {
        console.error('JWT decode hatası:', error);
        return null;
    }
};

/**
 * Access token'dan role bilgisini alır
 * @returns {string} - Role ('admin' veya 'user')
 */
export const getRoleFromToken = () => {
    try {
        const token = getTokenFromCookie('access_token_cookie');
        if (!token) return 'user';
        
        const decoded = decodeJWT(token);
        if (!decoded) return 'user';
        
        return decoded.role || 'user';
    } catch (error) {
        console.error('Role çıkarma hatası:', error);
        return 'user';
    }
};

/**
 * Token'ın expire olup olmadığını kontrol eder
 * @returns {boolean} - Token geçerliyse true, değilse false
 */
export const isTokenValid = () => {
    try {
        const token = getTokenFromCookie('access_token_cookie');
        if (!token) return false;
        
        const decoded = decodeJWT(token);
        if (!decoded || !decoded.exp) return false;
        
        // exp (expiration) Unix timestamp formatında
        const currentTime = Math.floor(Date.now() / 1000);
        
        return decoded.exp > currentTime;
    } catch (error) {
        console.error('Token validation hatası:', error);
        return false;
    }
};

/**
 * Token'dan username bilgisini alır
 * @returns {string|null} - Username veya null
 */
export const getUsernameFromToken = () => {
    try {
        const token = getTokenFromCookie('access_token_cookie');
        if (!token) return null;
        
        const decoded = decodeJWT(token);
        if (!decoded) return null;
        
        // 'sub' (subject) field'ı username içerir
        return decoded.sub || null;
    } catch (error) {
        console.error('Username çıkarma hatası:', error);
        return null;
    }
};

/**
 * Tüm token bilgilerini döndürür (debug için)
 * @returns {object|null} - Token payload veya null
 */
export const getTokenInfo = () => {
    try {
        const token = getTokenFromCookie('access_token_cookie');
        if (!token) return null;
        
        return decodeJWT(token);
    } catch (error) {
        console.error('Token info hatası:', error);
        return null;
    }
};
