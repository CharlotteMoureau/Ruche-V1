import domtoimage from "dom-to-image-more";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowsRotate, faCamera } from "@fortawesome/free-solid-svg-icons";

export default function Toolbar({ onReset }) {
  const handleExport = async () => {
    const board = document.querySelector(".hive-board");
    if (!board) return;

    document.body.classList.add("capture-mode");

    const backs = board.querySelectorAll(".hex-back");
    backs.forEach((el) => {
      el.setAttribute("data-original-visibility", el.style.visibility || "");
      el.style.visibility = "hidden";
    });

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
      backs.forEach((el) => {
        el.style.visibility = el.getAttribute("data-original-visibility");
        el.removeAttribute("data-original-visibility");
      });

      document.body.classList.remove("capture-mode");
    }
  };

  return (
    <div className="toolbar">
      <button onClick={onReset}>
        <FontAwesomeIcon icon={faArrowsRotate} /> Réinitialiser
      </button>
      <button onClick={handleExport}>
        <FontAwesomeIcon icon={faCamera} /> Capture d'écran
      </button>
    </div>
  );
}
