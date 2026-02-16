import jsPDF from "jspdf";

let fontLoaded = false;
let fontBase64: string | null = null;

export const loadBengaliFont = async (pdf: jsPDF): Promise<void> => {
  if (!fontBase64) {
    try {
      const response = await fetch("/fonts/NotoSansBengali.ttf");
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      fontBase64 = btoa(binary);
    } catch (e) {
      console.error("Failed to load Bengali font:", e);
      return;
    }
  }

  if (fontBase64) {
    pdf.addFileToVFS("NotoSansBengali.ttf", fontBase64);
    pdf.addFont("NotoSansBengali.ttf", "NotoSansBengali", "normal");
    fontLoaded = true;
  }
};

export const setBengaliFont = (pdf: jsPDF) => {
  if (fontLoaded) {
    pdf.setFont("NotoSansBengali", "normal");
  }
};

export const setEnglishFont = (pdf: jsPDF) => {
  pdf.setFont("helvetica", "normal");
};

export const setEnglishBoldFont = (pdf: jsPDF) => {
  pdf.setFont("helvetica", "bold");
};
