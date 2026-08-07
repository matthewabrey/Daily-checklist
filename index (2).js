import React, { createContext, useContext, useState, useEffect } from 'react';

// Authentication Context
const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }) {
  const [employee, setEmployee] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user was previously authenticated (session storage for now)
    const storedEmployee = sessionStorage.getItem('authenticated_employee');
    if (storedEmployee) {
      try {
        const empData = JSON.parse(storedEmployee);
        setEmployee(empData);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing stored employee data:', error);
        sessionStorage.removeItem('authenticated_employee');
      }
    }
    setLoading(false);
  }, []);

  const login = (employeeData) => {
    setEmployee(employeeData);
    setIsAuthenticated(true);
    sessionStorage.setItem('authenticated_employee', JSON.stringify(employeeData));
  };

  const logout = () => {
    setEmployee(null);
    setIsAuthenticated(false);
    sessionStorage.removeItem('authenticated_employee');
  };

  return (
    <AuthContext.Provider value={{ 
      employee, 
      isAuthenticated, 
      login, 
      logout, 
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
}
