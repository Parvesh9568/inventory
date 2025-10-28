import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

const Sidebar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Handle body scroll when sidebar is open (only on mobile/tablet)
  useEffect(() => {
    // Only lock scroll on mobile/tablet (less than 1025px)
    if (window.innerWidth < 1025) {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'unset';
      }
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
    
    // Add/remove class to main content for styling
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      if (!isOpen) {
        mainContent.classList.add('sidebar-open');
      } else {
        mainContent.classList.remove('sidebar-open');
      }
    }
  };

  // Function to close sidebar when navigation item is clicked (on all screen sizes)
  const closeSidebar = () => {
    // Close sidebar on all screen sizes when clicking a menu item
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    if (sidebar && mainContent) {
      sidebar.classList.remove('sidebar-open');
      mainContent.classList.remove('sidebar-open');
    }
    setIsOpen(false);
  };

  const menuItems = [
    {
      path: '/',
      icon: '📊',
      label: 'Dashboard',
      description: 'Overview & Analytics'
    },
    {
      path: '/out',
      icon: '📤',
      label: 'OUT Panel',
      description: 'Export Items'
    },
    {
      path: '/in',
      icon: '📥',
      label: 'IN Panel',
      description: 'Import Items'
    },
    {
      path: '/vendors',
      icon: '👥',
      label: 'Vendor Management',
      description: 'Add & Manage Vendors'
    },

    {
      path: '/wires',
      icon: '🗃️',
      label: 'Wire Management',
      description: 'Manage Wire & Payal'
    },
    // {
    //   path: '/search',
    //   icon: '🔍',
    //   label: 'Vender Profile',
    //   description: 'Find & Download'
    // },
    {
      path: '/vendor-transactions',
      icon: '📊',
      label: 'Vendor Transactions',
      description: 'View Transaction Records'
    },
   
  ];

  return (
    <>
      {/* Overlay - Click to close sidebar (only on mobile/tablet) */}
      {isOpen && window.innerWidth < 1025 && (
        <div 
          className="sidebar-overlay" 
          onClick={closeSidebar}
          style={{ cursor: 'pointer' }}
        ></div>
      )}

      {/* Sidebar */}
      <div className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <h3>💼 Management</h3>
          <p>IN/OUT Panel</p>
          <button 
            className="sidebar-close-btn"
            onClick={toggleSidebar}
            aria-label="Close Menu"
            title="Close Sidebar"
          >
            ✕
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={closeSidebar}
            >
              <div className="sidebar-icon">{item.icon}</div>
              <div className="sidebar-content">
                <div className="sidebar-label">{item.label}</div>
                <div className="sidebar-description">{item.description}</div>
              </div>
            </Link>
          ))}
        </nav>
        
        <div className="sidebar-footer">
          <div className="version-info">
            <small>Version 1.0</small>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
