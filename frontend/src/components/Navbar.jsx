import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, LogOut, Menu, X } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const { cart, setIsCartOpen } = useContext(CartContext);
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <nav className="bg-brand-dark text-brand-light sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="font-heading font-bold text-2xl tracking-wider text-brand-accent">VastraCo</span>
            </Link>
            <div className="hidden md:ml-10 md:flex md:space-x-8">
              <Link to="/products" className="hover:text-brand-accent px-3 py-2 rounded-md text-sm font-medium transition-colors">Shop</Link>
              <Link to="/products?category=Men's Shirts" className="hover:text-brand-accent px-3 py-2 rounded-md text-sm font-medium transition-colors">Men</Link>
              <Link to="/products?category=Women's Dresses" className="hover:text-brand-accent px-3 py-2 rounded-md text-sm font-medium transition-colors">Women</Link>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative hover:text-brand-accent transition-colors"
              aria-label="Open cart"
            >
              <ShoppingBag className="h-6 w-6" />
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-brand-accent text-brand-dark text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </button>

            {user ? (
              <div className="flex items-center space-x-4">
                <Link to="/orders" className="hover:text-brand-accent transition-colors" aria-label="My orders">
                  <User className="h-6 w-6" />
                </Link>
                <button onClick={handleLogout} className="hover:text-brand-accent transition-colors" title="Logout" aria-label="Logout">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <Link to="/login" className="hover:text-brand-accent transition-colors text-sm font-medium">
                Login / Register
              </Link>
            )}

            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(prev => !prev)}
                className="hover:text-brand-accent transition-colors"
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-brand-dark border-t border-gray-700 px-4 pt-2 pb-4 space-y-1">
          <Link
            to="/products"
            onClick={closeMobileMenu}
            className="block px-3 py-2 rounded-md text-base font-medium hover:text-brand-accent transition-colors"
          >
            Shop
          </Link>
          <Link
            to="/products?category=Men's Shirts"
            onClick={closeMobileMenu}
            className="block px-3 py-2 rounded-md text-base font-medium hover:text-brand-accent transition-colors"
          >
            Men
          </Link>
          <Link
            to="/products?category=Women's Dresses"
            onClick={closeMobileMenu}
            className="block px-3 py-2 rounded-md text-base font-medium hover:text-brand-accent transition-colors"
          >
            Women
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
