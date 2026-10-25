import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard,
  Sun,
  Moon,
  Users, 
  CalendarDays,
  Calendar,
  Star, 
  PhoneCall, 
  PhoneForwarded,
  FileText,
  BarChart3,
  CreditCard,
  History,
  ClipboardList,
  MessageSquareHeart,
  Menu,
  X as CloseIcon,
  Settings as SettingsIcon,
  LogOut
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import logoImg from './vehicleSpecs/MechHelp_Logo.png';
import './Sidebar.css';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/daily-quicks', label: 'Daily Quicks', icon: Sun },
    ]
  },
  {
    title: 'Leads & Reminders',
    items: [
      { path: '/leads', label: 'All Leads', icon: Users },
      { path: '/leads/today/morning', label: 'Reminders: Morning', icon: Sun },
      { path: '/leads/today/evening', label: 'Reminders: Evening', icon: Moon },
      { path: '/leads/details-shared', label: 'Detail Shared Reminders', icon: PhoneForwarded },
      { path: '/leads/quotation-shared', label: 'Quotation Reminder', icon: FileText },
      { path: '/sujal', label: 'Pending Call List', icon: PhoneCall },
    ]
  },
  {
    title: 'Bookings & Customers',
    items: [
      { path: '/bookings', label: 'Bookings', icon: CalendarDays },
      { path: '/bookings/calendar', label: 'Booking Calendar', icon: Calendar },
      { path: '/vip', label: 'VIP Customers', icon: Star },
      { path: '/daily-garage-board', label: 'Daily Garage Board', icon: ClipboardList },
    ]
  },
  {
    title: 'Finance & Analytics',
    items: [
      { path: '/settlements', label: 'Garage Settlement', icon: CreditCard },
      { path: '/reports', label: 'Reports', icon: BarChart3 },
      { path: '/history', label: 'History', icon: History },
      { path: '/feedback', label: 'Feedback', icon: MessageSquareHeart },
    ]
  }
];

export const Sidebar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  // Close mobile drawer on route transition
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <aside className={`sidebar surface-panel ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <img src={logoImg} alt="MechHelp Logo" className="sidebar-logo-img" />
        <button
          type="button"
          className="sidebar-mobile-toggle"
          onClick={() => setMobileOpen(prev => !prev)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <CloseIcon size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navSections.map((section, idx) => (
          <div key={section.title || idx} className="nav-section">
            {section.title && <div className="nav-section-title">{section.title}</div>}
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/' || item.path === '/leads' || item.path === '/bookings'}
                className={({ isActive }) =>
                  `nav-item${isActive ? ' active' : ''}`
                }
              >
                <div className="nav-icon">
                  <item.icon size={18} strokeWidth={1.8} />
                </div>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}

        <div className="nav-section sidebar-settings-section" style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            <div className="nav-icon">
              <SettingsIcon size={18} strokeWidth={1.8} />
            </div>
            <span className="nav-label">Settings</span>
          </NavLink>
        </div>

        {user && (
          <div className="sidebar-footer">
            <NavLink to="/settings" className="sidebar-user-info" style={{ textDecoration: 'none', cursor: 'pointer' }} title="Account Settings">
              <div className="sidebar-user-avatar">
                {(user.email?.[0] || 'A').toUpperCase()}
              </div>
              <div className="sidebar-user-details">
                <span className="sidebar-user-email">{user.email || 'Admin'}</span>
                <span className="sidebar-user-badge">Account Settings</span>
              </div>
            </NavLink>
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={logout}
              title="Sign out of CRM"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </nav>
    </aside>
  );
};
