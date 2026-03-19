import { Compass, Menu, Scale } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SearchBar from './SearchBar';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <header className="sticky top-0 z-40 border-b border-[#2e44b5] bg-[#10257f]/95 backdrop-blur-md">
      <div className="page-shell flex min-h-[78px] items-center gap-4 py-3">
        <Link to="/" className="flex min-w-fit items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/30 bg-white/10 text-white">
            <Compass size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">PantherSearch</div>
            <div className="text-xs text-blue-100/90">for GSU Students</div>
          </div>
        </Link>

        {!isHome ? (
          <div className="hidden flex-1 md:block">
            <SearchBar compact onSearch={(query) => navigate(`/?q=${encodeURIComponent(query)}`)} placeholder="Search classes, professors, or codes..." className="max-w-[620px] mx-auto" />
          </div>
        ) : (
          <div className="hidden flex-1 md:block" />
        )}

        <div className="hidden items-center gap-3 md:flex">
          <Link to="/compare" className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-[#1B3BFF] transition hover:bg-[#EEF2FF]">
            <Scale size={16} />
            Compare two classes
          </Link>
          <button type="button" onClick={() => navigate('/')} className="inline-flex items-center justify-center rounded-xl border border-[#6C2DFF] bg-[#6C2DFF] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5b24dd]">
            Search
          </button>
        </div>

        <button type="button" className="ml-auto inline-flex items-center justify-center rounded-xl border border-white/40 bg-white/10 px-3 py-2 text-white transition hover:bg-white/20 md:hidden">
          <Menu size={18} />
        </button>
      </div>
    </header>
  );
}
