import { Link, useLocation } from 'react-router-dom';

const Navigation = () => {
  const location = useLocation();

  return (
    <nav className="navigation">
      <div className="nav-links">
        <Link 
          to="/" 
          className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
        >
          🏠 Dashboard
        </Link>
        <Link 
          to="/in" 
          className={`nav-link ${location.pathname === '/in' ? 'active' : ''}`}
        >
          📥 IN Panel
        </Link>
        <Link 
          to="/out" 
          className={`nav-link ${location.pathname === '/out' ? 'active' : ''}`}
        >
          📤 OUT Panel
        </Link>
        <Link 
          to="/search" 
          className={`nav-link ${location.pathname === '/search' ? 'active' : ''}`}
        >
          🔍 Search Vendors
        </Link>
      </div>
    </nav>
  );
};

export default Navigation;
