import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Configure backend API base URL
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
axios.defaults.baseURL = API_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Set default auth headers on load
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Fetch user profile or decode token
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        // Check expiration
        if (decoded.exp * 1000 < Date.now()) {
          logout();
        } else {
          setUser({ id: decoded.id, username: decoded.username });
        }
      } catch (err) {
        console.error('Error decoding token', err);
        logout();
      }
    } else {
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
    }
    setLoading(false);
  }, [token]);

  // Log in
  const login = async (username, password) => {
    try {
      const response = await axios.post('/auth/login', { username, password });
      const { token: userToken, user: userData } = response.data;
      
      localStorage.setItem('token', userToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
      setToken(userToken);
      setUser(userData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Authentication failed',
      };
    }
  };

  // Sign up
  const register = async (username, password) => {
    try {
      const response = await axios.post('/auth/register', { username, password });
      const { token: userToken, user: userData } = response.data;
      
      localStorage.setItem('token', userToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
      setToken(userToken);
      setUser(userData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed',
      };
    }
  };

  // Log out
  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
