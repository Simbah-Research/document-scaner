let currentStream;
let currentTab = "camera";
let capturedImages = [];

// Konfigurasi
const CONFIG = {
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
  IMAGE_QUALITY: 1.0, // Kualitas maksimum
  PDF_MARGIN: 10,
  DEFAULT_PAGE_FORMAT: "a4",
};

// Inisialisasi drag and drop
const dragArea = document.querySelector(".drag-area");
const fileInput = dragArea.querySelector("input");
const browseBtn = dragArea.querySelector(".browse-btn");

// Event Listeners untuk Upload
browseBtn.addEventListener("click", () => fileInput.click());

dragArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  dragArea.classList.add("active");
});

dragArea.addEventListener("dragleave", () => {
  dragArea.classList.remove("active");
});

dragArea.addEventListener("drop", (e) => {
  e.preventDefault();
  dragArea.classList.remove("active");
  const files = Array.from(e.dataTransfer.files).filter((file) =>
    file.type.startsWith("image/")
  );
  processFiles(files);
});

fileInput.addEventListener("change", () => {
  const files = Array.from(fileInput.files);
  processFiles(files);
});

// Fungsi Optimasi Gambar
async function optimizeImage(imgData) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, img.width, img.height);

      resolve(canvas.toDataURL("image/jpeg", CONFIG.IMAGE_QUALITY));
    };
    img.src = imgData;
  });
}

// Fungsi Proses File
async function processFiles(files) {
  const validFiles = files.filter((file) => {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      alert(
        `File ${
          file.name
        } terlalu besar. Maksimum ukuran file adalah ${formatFileSize(
          CONFIG.MAX_FILE_SIZE
        )}`
      );
      return false;
    }
    if (!file.type.startsWith("image/")) {
      alert(`File ${file.name} bukan file gambar yang valid`);
      return false;
    }
    return true;
  });

  for (const file of validFiles) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const optimizedImgData = await optimizeImage(e.target.result);
      addImageToPreview(optimizedImgData);
    };
    reader.readAsDataURL(file);
  }
}

// Fungsi Preview Image
function addImageToPreview(imgData) {
  const imageList = document.getElementById("imageList");
  const imageItem = document.createElement("div");
  imageItem.className = "image-item";

  const img = document.createElement("img");
  img.src = imgData;

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
  deleteBtn.onclick = () => {
    imageItem.remove();
    capturedImages = capturedImages.filter((img) => img !== imgData);
  };

  imageItem.appendChild(img);
  imageItem.appendChild(deleteBtn);
  imageList.appendChild(imageItem);

  capturedImages.push(imgData);
}

// Fungsi Tab Management
function handleTabSwitch(tabName) {
  currentTab = tabName;

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("active");
  });
  document.querySelectorAll(".content").forEach((content) => {
    content.classList.remove("active");
  });

  const selectedTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  const selectedContent = document.getElementById(`${tabName}Content`);

  if (selectedTab) selectedTab.classList.add("active");
  if (selectedContent) selectedContent.classList.add("active");

  if (currentStream && tabName !== "camera") {
    stopCamera();
  }
}

// Fungsi Kamera
async function openCamera() {
  try {
    if (currentStream) {
      stopCamera();
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });

    const video = document.getElementById("video");
    video.srcObject = stream;
    currentStream = stream;
    video.style.display = "block";
    video.play();

    document.querySelector(".camera-controls button:last-child").style.display =
      "block";
  } catch (err) {
    alert("Tidak dapat mengakses kamera");
    console.error(err);
  }
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    const video = document.getElementById("video");
    video.style.display = "none";
    video.srcObject = null;
    document.querySelector(".camera-controls button:last-child").style.display =
      "none";
    currentStream = null;
  }
}

function captureImage() {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imgData = canvas.toDataURL("image/jpeg", CONFIG.IMAGE_QUALITY);
  addImageToPreview(imgData);
}

// Fungsi Generate PDF
async function generateDocument() {
  const filename = document.getElementById("filename").value || "document";
  const loader = document.getElementById("loader");

  if (
    capturedImages.length === 0 &&
    !document.getElementById("textInput").value
  ) {
    alert("Mohon tambahkan gambar atau teks terlebih dahulu");
    return;
  }

  loader.style.display = "flex";
  loader.querySelector("p").textContent = "Mempersiapkan dokumen...";

  try {
    await generatePDF(filename);
  } catch (error) {
    alert("Terjadi kesalahan saat generate dokumen");
    console.error(error);
  } finally {
    loader.style.display = "none";
  }
}
function loadImage(imgData) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imgData;
  });
}

async function generatePDF(filename) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: CONFIG.DEFAULT_PAGE_FORMAT,
    compress: false, // Ubah ke false untuk menghindari masalah kompresi
  });

  const imagesPerPage = document.getElementById("imagesPerPage").value;
  const text = document.getElementById("textInput").value;

  // Handle teks
  if (text) {
    loader.querySelector("p").textContent = "Memproses teks...";
    const textLines = doc.splitTextToSize(text, 190);
    doc.setFontSize(12);
    doc.text(textLines, 10, 10);
    if (textLines.length > 0) {
      doc.addPage();
    }
  }

  // Proses gambar
  loader.querySelector("p").textContent = "Memproses gambar...";

  // Tunggu semua gambar dimuat
  const loadImages = capturedImages.map((imgData) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = imgData;
    });
  });

  try {
    const loadedImages = await Promise.all(loadImages);

    if (imagesPerPage === "all") {
      // Multiple images per page
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = CONFIG.PDF_MARGIN;
      const maxImagesPerRow = 2;
      const maxRows = 3;
      const imagesPerPageCount = maxImagesPerRow * maxRows;

      for (let i = 0; i < loadedImages.length; i++) {
        if (i > 0 && i % imagesPerPageCount === 0) {
          doc.addPage();
        }

        const position = i % imagesPerPageCount;
        const row = Math.floor(position / maxImagesPerRow);
        const col = position % maxImagesPerRow;

        const imgWidth =
          (pageWidth - margin * (maxImagesPerRow + 1)) / maxImagesPerRow;
        const imgHeight = (pageHeight - margin * (maxRows + 1)) / maxRows;
        const x = margin + col * (imgWidth + margin);
        const y = margin + row * (imgHeight + margin);

        try {
          doc.addImage(
            loadedImages[i],
            "JPEG",
            x,
            y,
            imgWidth,
            imgHeight,
            `img${i}`, // Tambahkan alias unik
            "NONE" // Gunakan 'NONE' untuk kompresi
          );
        } catch (error) {
          console.error(`Error adding image ${i}:`, error);
        }
      }
    } else {
      // One image per page
      for (let i = 0; i < loadedImages.length; i++) {
        if (i > 0) doc.addPage();

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = CONFIG.PDF_MARGIN;

        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;

        const img = loadedImages[i];
        const imgAspectRatio = img.width / img.height;

        let finalWidth = maxWidth;
        let finalHeight = maxWidth / imgAspectRatio;

        if (finalHeight > maxHeight) {
          finalHeight = maxHeight;
          finalWidth = maxHeight * imgAspectRatio;
        }

        const x = margin + (maxWidth - finalWidth) / 2;
        const y = margin + (maxHeight - finalHeight) / 2;

        try {
          doc.addImage(
            img,
            "JPEG",
            x,
            y,
            finalWidth,
            finalHeight,
            `img${i}`, // Tambahkan alias unik
            "NONE" // Gunakan 'NONE' untuk kompresi
          );
        } catch (error) {
          console.error(`Error adding image ${i}:`, error);
        }
      }
    }
    function addImageToPreview(imgData) {
      loadImage(imgData)
        .then(() => {
          const imageList = document.getElementById("imageList");
          const imageItem = document.createElement("div");
          imageItem.className = "image-item";

          const img = document.createElement("img");
          img.src = imgData;

          const deleteBtn = document.createElement("button");
          deleteBtn.className = "delete-btn";
          deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
          deleteBtn.onclick = () => {
            imageItem.remove();
            capturedImages = capturedImages.filter((img) => img !== imgData);
          };

          imageItem.appendChild(img);
          imageItem.appendChild(deleteBtn);
          imageList.appendChild(imageItem);

          capturedImages.push(imgData);
        })
        .catch((error) => {
          console.error("Error loading image:", error);
          alert("Gambar tidak valid atau rusak");
        });
    }

    // Simpan PDF
    loader.querySelector("p").textContent = "Menyimpan dokumen...";
    doc.save(`${filename}.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("Terjadi kesalahan saat generate PDF. Silakan coba lagi.");
  }
}

async function processMultipleImagesPerPage(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = CONFIG.PDF_MARGIN;
  const maxImagesPerRow = 2;
  const maxRows = 3;
  const imagesPerPageCount = maxImagesPerRow * maxRows;

  const imgWidth =
    (pageWidth - margin * (maxImagesPerRow + 1)) / maxImagesPerRow;
  const imgHeight = (pageHeight - margin * (maxRows + 1)) / maxRows;

  for (let i = 0; i < capturedImages.length; i++) {
    if (i > 0 && i % imagesPerPageCount === 0) {
      doc.addPage();
    }

    const position = i % imagesPerPageCount;
    const row = Math.floor(position / maxImagesPerRow);
    const col = position % maxImagesPerRow;

    const x = margin + col * (imgWidth + margin);
    const y = margin + row * (imgHeight + margin);

    try {
      const optimizedImgData = await optimizeImage(capturedImages[i]);
      doc.addImage(
        optimizedImgData,
        "JPEG",
        x,
        y,
        imgWidth,
        imgHeight,
        undefined,
        "FAST",
        0
      );
    } catch (error) {
      console.error(`Error processing image ${i + 1}:`, error);
      continue;
    }
  }
}

async function processOneImagePerPage(doc) {
  for (let i = 0; i < capturedImages.length; i++) {
    if (i > 0) doc.addPage();

    try {
      const optimizedImgData = await optimizeImage(capturedImages[i]);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = CONFIG.PDF_MARGIN;

      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;

      const img = new Image();
      img.src = optimizedImgData;

      let finalWidth = maxWidth;
      let finalHeight = (img.height * maxWidth) / img.width;

      if (finalHeight > maxHeight) {
        finalHeight = maxHeight;
        finalWidth = (img.width * maxHeight) / img.height;
      }

      const xOffset = margin + (maxWidth - finalWidth) / 2;
      const yOffset = margin + (maxHeight - finalHeight) / 2;

      doc.addImage(
        optimizedImgData,
        "JPEG",
        xOffset,
        yOffset,
        finalWidth,
        finalHeight,
        undefined,
        "FAST",
        0
      );
    } catch (error) {
      console.error(`Error processing image ${i + 1}:`, error);
      continue;
    }
  }
}

// Utility Functions
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function clearAll() {
  if (confirm("Hapus semua gambar?")) {
    document.getElementById("imageList").innerHTML = "";
    capturedImages = [];
    document.getElementById("textInput").value = "";
    document.getElementById("filename").value = "";
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  handleTabSwitch("camera");
});
