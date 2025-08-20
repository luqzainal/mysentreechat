import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api'; // Import instance axios

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Untuk status loading awal

  // Cuba muatkan data pengguna dari localStorage semasa aplikasi dimuatkan
  useEffect(() => {
    const storedUser = localStorage.getItem('userInfo');
    const accessToken = localStorage.getItem('accessToken');

    if (storedUser && accessToken) {
      try {
        setUser(JSON.parse(storedUser));
        // Set header Authorization untuk permintaan axios seterusnya
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      } catch (error) {
        console.error("Gagal memparse data pengguna dari localStorage:", error);
        // Jika gagal parse, buang data lama
        localStorage.removeItem('userInfo');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    }
    setLoading(false); // Selesai memuatkan state awal
  }, []);

  // Fungsi untuk login
  const login = (userData, accessToken, refreshToken) => {
    localStorage.setItem('userInfo', JSON.stringify(userData));
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
    // Set header Authorization untuk permintaan axios seterusnya
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    console.log("AuthContext: Pengguna berjaya log masuk", userData);
    console.log("AuthContext: Access token disimpan", accessToken);

  };

  // Fungsi untuk logout
  const logout = () => {
    localStorage.removeItem('userInfo');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    // Buang header Authorization
    delete api.defaults.headers.common['Authorization'];
     console.log("AuthContext: Pengguna log keluar");
  };

  // Fungsi untuk refresh user data dari server
  const refreshUserData = async () => {
    try {
      const response = await api.get('/auth/me'); // Endpoint untuk get current user
      const updatedUserData = response.data.user;
      
      // Update localStorage dengan data terbaru
      localStorage.setItem('userInfo', JSON.stringify(updatedUserData));
      setUser(updatedUserData);
      
      console.log("AuthContext: User data refreshed successfully", updatedUserData);
      return updatedUserData;
    } catch (error) {
      console.error("AuthContext: Failed to refresh user data", error);
      // Jika token expired, logout user
      if (error.response?.status === 401) {
        logout();
      }
      throw error;
    }
  };

  const value = {
    user,
    setUser, // Mungkin diperlukan untuk kemaskini profil
    login,
    logout,
    refreshUserData, // Tambah function refresh user data
    loading, // Tambah loading state
    isAuthenticated: !!user // Cara mudah check jika pengguna sudah log masuk
  };

  // Jangan render children sehingga state awal selesai dimuatkan
  // Ini penting untuk elak redirect yang tidak perlu
  // if (loading) {
  //   return <div>Memuatkan...</div>; // Atau komponen spinner
  // }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook custom untuk menggunakan AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth mesti digunakan dalam AuthProvider');
  }
  return context;
}; 