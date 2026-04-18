const Footer = () => (
  <footer className="shrink-0 border-t border-slate-100 bg-white px-6 py-3 animate-fade-in">
    <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-between sm:gap-0">
      <p className="text-xs text-slate-400">
        © {new Date().getFullYear()} Printing Press System
      </p>
      <p className="text-xs text-slate-400">
        Created by{' '}
        <span className="font-medium text-slate-500 transition-colors duration-150 hover:text-slate-700 cursor-default">
          Hafiz Muneeb
        </span>
      </p>
    </div>
  </footer>
);

export default Footer;
