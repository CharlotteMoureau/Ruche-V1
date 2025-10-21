import { toPng } from "html-to-image";

export default function Toolbar({ onReset }) {
  const handleExport = async () => {
    const board = document.querySelector(".hive-board");
    if (!board) return;

    // Activer le mode capture
    document.body.classList.add("capture-mode");

    // Cloner les styles du document dans le board
    const styleElements = document.querySelectorAll(
      "style, link[rel='stylesheet']"
    );
    styleElements.forEach((style) => {
      board.appendChild(style.cloneNode(true));
    });

    // Masquer les dos des cartes
    const backs = board.querySelectorAll(".hex-back");
    backs.forEach((el) => {
      el.setAttribute("data-original-visibility", el.style.visibility || "");
      el.style.visibility = "hidden";
    });

    // Attendre 5 secondes
    await new Promise((resolve) => setTimeout(resolve, 5000));

    try {
      const dataUrl = await toPng(board, { cacheBust: true });

      const link = document.createElement("a");
      link.download = "ruche.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Erreur lors de la capture :", err);
    } finally {
      // Restaurer la visibilité des dos des cartes
      backs.forEach((el) => {
        el.style.visibility = el.getAttribute("data-original-visibility");
        el.removeAttribute("data-original-visibility");
      });

      // Retirer le mode capture
      document.body.classList.remove("capture-mode");
    }
  };

  return (
    <div className="toolbar">
      <button onClick={onReset}>🔄 Réinitialiser</button>
      <button onClick={handleExport}>📷 Capture d'écran</button>
    </div>
  );
}
