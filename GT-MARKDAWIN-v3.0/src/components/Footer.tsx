export default function Footer() {
  const handleLink = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // In Electron, setWindowOpenHandler handles target="_blank",
    // but for extra safety override click to avoid in-window navigation
    if ((window as any).electronAPI?.isElectron) {
      e.preventDefault();
      // Will be caught by will-navigate / setWindowOpenHandler in main.cjs
      window.open(e.currentTarget.href, '_blank');
    }
  };

  return (
    <footer className="footer">
      <span>GT-MARKDAWIN v3.1</span>
      <span>·</span>
      <a
        href="https://github.com/SalehGNUTUX/GT-MARKDAWIN"
        target="_blank"
        rel="noreferrer noopener"
        onClick={handleLink}
      >
        SalehGNUTUX
      </a>
      <span>·</span>
      <span>GPL-3.0</span>
    </footer>
  );
}
