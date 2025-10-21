import domtoimage from "dom-to-image-more";

export default function Toolbar({ onReset }) {
  const handleExport = async () => {
    const board = document.querySelector(".hive-board");
    if (!board) return;

    // Activer le mode capture
    document.body.classList.add("capture-mode");

    // Masquer les dos des cartes
    const backs = board.querySelectorAll(".hex-back");
    backs.forEach((el) => {
      el.setAttribute("data-original-visibility", el.style.visibility || "");
      el.style.visibility = "hidden";
    });

    // Attendre un petit délai pour que les styles s’appliquent
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      const dataUrl = await domtoimage.toPng(board, {
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = "ruche.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Erreur lors de la capture :", err);
      alert("Erreur lors de la capture : " + err.message);
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
