import { toPng } from "html-to-image";

export default function Toolbar({ onReset }) {
  const handleExport = () => {
    const board = document.querySelector(".hive-board");
    if (!board) return;

    toPng(board, { cacheBust: true })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = "ruche.png";
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => console.error(err));
  };

  return (
    <div className="toolbar">
      <button onClick={onReset}>🔄 Reset la ruche</button>
      <button onClick={handleExport}>📷 Exporter la ruche</button>
    </div>
  );
}
