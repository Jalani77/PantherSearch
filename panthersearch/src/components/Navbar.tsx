import { Menu, Scale } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SearchBar from './SearchBar';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-white/95 backdrop-blur">
      <div className="page-shell flex min-h-[72px] items-center gap-4 py-3">
        <Link to="/" className="flex min-w-fit items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-black bg-black text-white">P</div>
          <div>
            <div className="text-sm font-semibold text-[#111111]">PantherSearch</div>
            <div className="text-caption">for GSU Students</div>
          </div>
        </Link>

        {!isHome ? (
          <div className="hidden flex-1 md:block">
            <SearchBar compact onSearch={(query) => navigate(`/?q=${encodeURIComponent(query)}`)} placeholder="Search classes, professors, or codes..." />
          </div>
        ) : (
          <div className="hidden flex-1 md:block" />
        )}

        <div className="hidden items-center gap-3 md:flex">
          <Link to="/compare" className="btn-outline gap-2">
            <Scale size={16} />
            Compare two classes
          </Link>
          <button type="button" onClick={() => navigate('/')} className="btn-black">
            Search
          </button>
        </div>

        <button type="button" className="btn-outline ml-auto md:hidden">
          <Menu size={18} />
        </button>
      </div>
    </header>
  );
}
